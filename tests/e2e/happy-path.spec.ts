import { test, expect } from "@playwright/test";
import path from "node:path";
import { testDb } from "./helpers/db";
import { getSessionId } from "./helpers/session";
import * as funnel from "./helpers/funnel";

const PHOTO = path.join(__dirname, "fixtures", "test-photo.png");

test.describe("Critical E2E happy path — paid landing, two walls, skip photo", () => {
  test("full funnel persists correct durable state with exactly one booking intent", async ({ page }) => {
    await page.goto(
      "/toronto/wall-makeover?utm_source=facebook&utm_medium=paid_social&utm_campaign=phase_c_test"
    );
    await page.locator('a[href="/quote"]:has-text("Get My Price")').first().click();
    await page.waitForURL("**/quote/project");

    await funnel.selectService(page, "Wall Panels");
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");

    await funnel.fillWall(page, 0, "3", "2.5");
    await funnel.addWall(page);
    await funnel.fillWall(page, 1, "2", "2");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/photo");

    await funnel.skipPhoto(page);
    await page.waitForURL("**/quote/style");

    await funnel.selectStyleAndMaterial(page, "Dark Walnut", "I need material + installation");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");
    await page.waitForSelector("text=Total (incl. tax)");

    const priceText = await page.locator("p.text-4xl").textContent();
    expect(priceText).toBe("$1,884.28");

    await page.click('a:has-text("Continue with this estimate")');
    await page.waitForURL("**/quote/contact");
    const sessionId = await getSessionId(page);

    await funnel.fillContact(page, "Amara", "amara.phase-c@example.com", "416-555-0142");
    await page.waitForURL("**/quote/timing");

    await funnel.selectTimingAndSubmit(page, "Within 1");
    // Session G: payment now sits between timing and confirmation (D040).
    await page.waitForURL("**/quote/payment", { timeout: 10_000 });
    await page.getByRole("button", { name: /Pay .* with PayPal/ }).click();
    await page.waitForURL("**/quote/confirmation", { timeout: 10_000 });
    await page.waitForSelector("text=Your project request is in.");
    await page.waitForSelector("text=Payment confirmed");

    // --- Durable server-state verification (not just UI) ---
    const lead = await testDb.lead.findUnique({
      where: { sessionId },
      include: { attribution: true, contact: true, timing: true, quoteSnapshots: true, bookingIntent: true },
    });

    expect(lead).not.toBeNull();
    expect(lead!.status).toBe("BOOKING_INTENT");
    expect(lead!.currentStep).toBe("CONFIRMATION");
    expect(lead!.serviceSlug).toBe("wall-panels");
    expect(Number(lead!.totalAreaM2)).toBe(11.5);
    expect(lead!.materialOwnership).toBe("MATERIAL_AND_INSTALL");

    expect(lead!.attribution).not.toBeNull();
    expect(lead!.attribution!.utmSource).toBe("facebook");
    expect(lead!.attribution!.utmCampaign).toBe("phase_c_test");

    expect(lead!.contact).not.toBeNull();
    expect(lead!.contact!.firstName).toBe("Amara");
    expect(lead!.contact!.email).toBe("amara.phase-c@example.com");

    expect(lead!.timing).not.toBeNull();
    expect(lead!.timing!.value).toBe("WITHIN_2_WEEKS");

    expect(lead!.quoteSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(lead!.bookingIntent).not.toBeNull();

    const snapshot = lead!.quoteSnapshots.find((s) => s.id === lead!.bookingIntent!.quoteSnapshotId);
    expect(snapshot).toBeDefined();
    expect(snapshot!.totalMinor).toBe(188428);
    expect(snapshot!.subtotalMinor + snapshot!.taxMinor).toBe(snapshot!.totalMinor);

    // Exactly one logical booking intent — not one per snapshot/retry.
    const bookingIntentCount = await testDb.bookingIntent.count({ where: { leadId: lead!.id } });
    expect(bookingIntentCount).toBe(1);
  });
});

test.describe("Second happy path — homepage, single wall, photo upload, install only", () => {
  test("full funnel persists correct durable state", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/quote"]:has-text("Get Your Price")').nth(1).click();
    await page.waitForURL("**/quote/project");

    await funnel.selectService(page, "Marble Sheets");
    await funnel.enterLocation(page, "M6K 3E3");
    await page.waitForURL("**/quote/measurements");

    await funnel.fillWall(page, 0, "2.4", "3");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/photo");

    await funnel.uploadPhoto(page, PHOTO);
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/style");

    await funnel.selectStyleAndMaterial(page, "White", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");
    await page.waitForSelector("text=Total (incl. tax)");

    const priceText = await page.locator("p.text-4xl").textContent();
    expect(priceText).toBe("$976.32");

    await page.click('a:has-text("Continue with this estimate")');
    await page.waitForURL("**/quote/contact");
    const sessionId = await getSessionId(page);

    await funnel.fillContact(page, "Diego", "diego.phase-c@example.com", "6475550199");
    await page.waitForURL("**/quote/timing");

    await funnel.selectTimingAndSubmit(page, "Just planning");
    await page.waitForURL("**/quote/payment", { timeout: 10_000 });
    await page.getByRole("button", { name: /Pay .* with PayPal/ }).click();
    await page.waitForURL("**/quote/confirmation", { timeout: 10_000 });
    await page.waitForSelector("text=Your project request is in.");

    const lead = await testDb.lead.findUnique({
      where: { sessionId },
      include: { contact: true, timing: true, bookingIntent: true },
    });

    expect(lead).not.toBeNull();
    expect(lead!.status).toBe("BOOKING_INTENT");
    expect(lead!.serviceSlug).toBe("marble-sheets");
    expect(lead!.materialOwnership).toBe("INSTALL_ONLY");
    expect(Number(lead!.totalAreaM2)).toBe(7.2);
    expect(lead!.contact!.firstName).toBe("Diego");
    expect(lead!.timing!.value).toBe("JUST_PLANNING");
    expect(lead!.bookingIntent).not.toBeNull();

    // Photo bytes are intentionally never persisted server-side (spec
    // section 29) — no media/photo table exists to assert against at all.
    // This comment documents the deliberate absence, not an oversight.
  });
});
