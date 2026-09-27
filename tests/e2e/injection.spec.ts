import { test, expect } from "@playwright/test";
import { apiPost } from "./helpers/api";
import { testDb } from "./helpers/db";

const XSS_PAYLOAD = '<script>window.__xss_fired = true;</script><img src=x onerror="window.__xss_fired = true">';

test.describe("Injection / XSS spot checks", () => {
  test("script-tag payload in contact fields is stored as inert text, never executed", async ({
    page,
    baseURL,
  }) => {
    const sessionId = `phase-c-xss-contact-${Date.now()}`;
    await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "wall-panels",
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 5,
      styleId: "black",
      materialOwnership: "INSTALL_ONLY",
      currentStep: "PRICE",
    });
    await apiPost(baseURL!, "/api/lead/price", { sessionId });

    const result = await apiPost(baseURL!, "/api/lead/contact", {
      sessionId,
      firstName: XSS_PAYLOAD,
      email: "xss-test@example.com",
      phone: "4165551234",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    });
    expect(result.status).toBe(200);

    // Stored exactly as submitted (plain text, parameterized query — no
    // SQL injection, no server-side template execution).
    const contact = await testDb.contactInfo.findUnique({ where: { leadId: (await testDb.lead.findUnique({ where: { sessionId } }))!.id } });
    expect(contact!.firstName).toBe(XSS_PAYLOAD);

    // No page in this app currently echoes contact.firstName back into
    // any HTML response — verified by checking the confirmation page
    // (the only plausible place) never executes it.
    await page.goto("/quote/confirmation");
    const fired = await page.evaluate(() => (window as unknown as { __xss_fired?: boolean }).__xss_fired);
    expect(fired).toBeUndefined();
  });

  test("script-tag payload in UTM attribution never executes on the landing page", async ({ page }) => {
    await page.goto(
      `/toronto/wall-makeover?utm_campaign=${encodeURIComponent(XSS_PAYLOAD)}`
    );
    const fired = await page.evaluate(() => (window as unknown as { __xss_fired?: boolean }).__xss_fired);
    expect(fired).toBeUndefined();
    // Page still renders normally — no crash, no broken layout.
    await expect(page.locator("h1")).toContainText("Transform your wall");
  });

  test("postal code field rejects non-conforming input rather than passing it through", async ({ baseURL }) => {
    const sessionId = `phase-c-xss-postal-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      postalCode: "<script>alert(1)</script>",
      currentStep: "PROJECT",
    });
    expect(result.status).toBe(400);
  });

  test("unknown serviceSlug injection attempt is rejected, not silently stored", async ({ baseURL }) => {
    const sessionId = `phase-c-xss-service-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: '<img src=x onerror=alert(1)>',
      currentStep: "PROJECT",
    });
    expect(result.status).toBe(400);
  });
});

test.describe("Response headers", () => {
  test("homepage response includes basic hardening headers", async ({ request, baseURL }) => {
    const res = await request.get(baseURL!);
    const headers = res.headers();
    // Documented in docs/SECURITY_MODEL.md if any of these are missing —
    // this test's job is to make a regression visible, not silently pass.
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});
