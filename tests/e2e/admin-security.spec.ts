import { test, expect } from "@playwright/test";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureTestAdmin } from "./helpers/admin";
import { testDb } from "./helpers/db";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

async function seedRealJob(baseURL: string, sessionId: string) {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug: "wall-panels",
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 10,
      styleId: "black",
      materialOwnership: "INSTALL_ONLY",
      currentStep: "PRICE",
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/price", { sessionId }, ip);
  await apiPost(
    baseURL,
    "/api/lead/contact",
    {
      sessionId,
      firstName: "Security",
      email: `${sessionId}@example.com`,
      phone: "4165550000",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  const bi = await apiPost<{ bookingIntentId: string }>(baseURL, "/api/lead/booking-intent", { sessionId }, ip);
  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
  return { lead: lead!, job: job!, bookingIntentId: (bi.json as { data: { bookingIntentId: string } }).data.bookingIntentId };
}

test.describe("IDOR / BOLA — a customer-only session must never reach admin resources", () => {
  // Every other test in this suite starts pre-authenticated as admin (see
  // global-setup.ts) — these specifically need a real, non-admin customer
  // session to prove admin data isn't reachable from it.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a real customer funnel session cannot read the leads admin page", async ({ page, baseURL }) => {
    const sessionId = `admin-idor-${Date.now()}`;
    await seedRealJob(baseURL!, sessionId);

    // Establish a genuine customer session cookie/localStorage by visiting the funnel —
    // this is a real visitor, not a blank browser, and still must not see admin data.
    await page.goto(`${baseURL}/quote/project`, { waitUntil: "networkidle" });

    await page.goto(`${baseURL}/admin/leads`, { waitUntil: "networkidle" });
    expect(page.url()).toBe(`${baseURL}/admin/login`);
  });

  test("a real customer session cannot call admin lead/job/professional APIs directly", async ({ page, baseURL }) => {
    const sessionId = `admin-idor-api-${Date.now()}`;
    const { job } = await seedRealJob(baseURL!, sessionId);
    await page.goto(`${baseURL}/quote/project`, { waitUntil: "networkidle" });

    const statusRes = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, {
      data: { status: "REVIEWING" },
    });
    expect(statusRes.status()).toBe(401);

    const assignRes = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, {
      data: { professionalId: "irrelevant" },
    });
    expect(assignRes.status()).toBe(401);
  });
});

test.describe("Mass assignment — only whitelisted fields are ever accepted", () => {
  test("professional create ignores a client-supplied id and server-generates one instead", async ({
    page,
    baseURL,
  }) => {
    const forcedId = "attacker-chosen-id-12345";
    const res = await page.request.post(`${baseURL}/api/admin/professionals`, {
      data: {
        id: forcedId,
        displayName: "Mass Assignment Test",
        email: `mass-assign-${Date.now()}@example.com`,
        phone: "4165550001",
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.id).not.toBe(forcedId);

    const row = await testDb.professional.findUnique({ where: { id: json.data.id } });
    expect(row).not.toBeNull();
    expect(row!.createdAt.getFullYear()).toBeGreaterThan(2000);
  });

  test("job status-change endpoint ignores a smuggled assignedProfessionalId field", async ({ page, baseURL }) => {
    const sessionId = `mass-assign-status-${Date.now()}`;
    const { job } = await seedRealJob(baseURL!, sessionId);

    const pro = await testDb.professional.create({
      data: { displayName: "Sneaky Target", email: `sneaky-${Date.now()}@example.com`, phone: "4165550002" },
    });

    const res = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, {
      data: { status: "REVIEWING", assignedProfessionalId: pro.id },
    });
    expect(res.status()).toBe(200);

    const updated = await testDb.job.findUnique({ where: { id: job.id } });
    expect(updated!.status).toBe("REVIEWING");
    expect(updated!.assignedProfessionalId).toBeNull(); // the smuggled field must have no effect
  });

  test("professional update ignores an attempt to overwrite createdAt", async ({ page, baseURL }) => {
    const pro = await testDb.professional.create({
      data: { displayName: "Original", email: `original-${Date.now()}@example.com`, phone: "4165550003" },
    });
    const originalCreatedAt = pro.createdAt.toISOString();

    const res = await page.request.fetch(`${baseURL}/api/admin/professionals/${pro.id}`, {
      method: "PATCH",
      data: { displayName: "Updated", createdAt: "2000-01-01T00:00:00.000Z" },
    });
    expect(res.status()).toBe(200);

    const updated = await testDb.professional.findUnique({ where: { id: pro.id } });
    expect(updated!.displayName).toBe("Updated");
    expect(updated!.createdAt.toISOString()).toBe(originalCreatedAt);
  });
});

test.describe("Stored XSS spot check", () => {
  test("a script-tag payload in a professional's name is stored as inert text, never executed", async ({
    page,
    baseURL,
  }) => {
    const payload = '<script>window.__xss_fired = true;</script>';
    const res = await page.request.post(`${baseURL}/api/admin/professionals`, {
      data: { displayName: payload, email: `xss-${Date.now()}@example.com`, phone: "4165550004" },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();

    await page.goto(`${baseURL}/admin/professionals/${json.data.id}`, { waitUntil: "networkidle" });
    const fired = await page.evaluate(() => (window as unknown as { __xss_fired?: boolean }).__xss_fired);
    expect(fired).toBeUndefined();

    // The raw payload must still be present as literal text (React escapes it) —
    // not silently stripped, which would be a different (data-loss) bug.
    const value = await page.locator("#displayName").inputValue();
    expect(value).toBe(payload);
  });
});

test.describe("CSRF / origin protection on admin mutations", () => {
  test("a mutation with a mismatched Origin header is rejected", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/professionals`, {
      headers: { Origin: "https://evil-attacker.example" },
      data: { displayName: "Should Be Blocked", email: `csrf-${Date.now()}@example.com`, phone: "4165550005" },
    });
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("FORBIDDEN");
  });
});
