import { test, expect } from "@playwright/test";
import { apiPost } from "./helpers/api";
import * as funnel from "./helpers/funnel";

/**
 * Session H0.2 — styles are service-specific. Before this, every service
 * showed the identical global 6-style list, and switching services never
 * cleared an already-chosen style — a customer could pick "Light Oak"
 * for Wall Panels, switch to Wallpaper, and both the wood-toned style
 * options and the stale "Light Oak" selection itself would carry over.
 */

async function goThroughToStyle(page: import("@playwright/test").Page, serviceCard: string) {
  await page.goto("/quote/project");
  await funnel.selectService(page, serviceCard);
  await funnel.enterLocation(page, "M5V 2T6");
  await page.waitForURL("**/quote/measurements");
  await funnel.fillWall(page, 0, "3", "2.5");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/photo");
  await funnel.skipPhoto(page);
  await page.waitForURL("**/quote/style");
}

test.describe("Service-specific styles", () => {
  test("Wall Panels shows wood-toned styles, Wallpaper does not", async ({ page }) => {
    await goThroughToStyle(page, "Wall Panels");
    for (const name of ["Light Oak", "Natural Wood", "Dark Walnut"]) {
      await expect(page.locator(`button:has-text("${name}")`)).toBeVisible();
    }
    // Wallpaper-only styles must not appear for Wall Panels.
    await expect(page.locator('button:has-text("Botanical")')).toHaveCount(0);
  });

  test("Wallpaper shows pattern-based styles only", async ({ page }) => {
    await goThroughToStyle(page, "Wallpaper");
    for (const name of ["Neutral", "Textured", "Geometric", "Botanical"]) {
      await expect(page.locator(`button:has-text("${name}")`)).toBeVisible();
    }
    await expect(page.locator('button:has-text("Light Oak")')).toHaveCount(0);
    await expect(page.locator('button:has-text("White Marble")')).toHaveCount(0);
  });

  test("Marble Sheets shows marble-specific styles only", async ({ page }) => {
    await goThroughToStyle(page, "Marble Sheets");
    for (const name of ["White Marble", "Grey Vein Marble", "Black Marble"]) {
      await expect(page.locator(`button:has-text("${name}")`)).toBeVisible();
    }
    await expect(page.locator('button:has-text("Light Oak")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Botanical")')).toHaveCount(0);
  });

  test("Decorative Partitions shows partition-appropriate styles only", async ({ page }) => {
    await goThroughToStyle(page, "Decorative Partitions");
    for (const name of ["Wood Slat", "Geometric", "Minimal", "Black"]) {
      await expect(page.locator(`button:has-text("${name}")`)).toBeVisible();
    }
    await expect(page.locator('button:has-text("White Marble")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Light Oak")')).toHaveCount(0);
  });
});

test.describe("Invalid style is cleared on service change", () => {
  test("Wall Panels + Light Oak -> switch to Wallpaper -> Light Oak is removed", async ({ page }) => {
    await goThroughToStyle(page, "Wall Panels");
    await funnel.selectStyleAndMaterial(page, "Light Oak", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");

    // Explicit override to a different service (H0.1's service-selection
    // mechanism), then walk back to the style step.
    await page.goto("/");
    await page.click('a:has-text("Wallpaper")');
    await page.waitForURL(/service=wallpaper/);
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");
    await page.click('button:has-text("Continue")'); // dimensions already persisted
    await page.waitForURL("**/quote/photo");
    await funnel.skipPhoto(page);
    await page.waitForURL("**/quote/style");

    await expect(page.locator('button:has-text("Light Oak")')).toHaveCount(0);
    await expect(page.locator(`div.grid-cols-3 button[aria-pressed="true"]`)).toHaveCount(0);
  });

  test("Wallpaper style -> switch to Marble Sheets -> invalid Wallpaper style is removed", async ({ page }) => {
    await goThroughToStyle(page, "Wallpaper");
    await funnel.selectStyleAndMaterial(page, "Botanical", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");

    await page.goto("/");
    await page.click('a:has-text("Marble Sheets")');
    await page.waitForURL(/service=marble-sheets/);
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/photo");
    await funnel.skipPhoto(page);
    await page.waitForURL("**/quote/style");

    await expect(page.locator('button:has-text("Botanical")')).toHaveCount(0);
    await expect(page.locator(`div.grid-cols-3 button[aria-pressed="true"]`)).toHaveCount(0);
  });

  test("Marble Sheets -> Decorative Partitions clears the marble style", async ({ page }) => {
    await goThroughToStyle(page, "Marble Sheets");
    await funnel.selectStyleAndMaterial(page, "Black Marble", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");

    await page.goto("/");
    await page.click('a:has-text("Decorative Partitions")');
    await page.waitForURL(/service=decorative-partitions/);
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/photo");
    await funnel.skipPhoto(page);
    await page.waitForURL("**/quote/style");

    await expect(page.locator('button:has-text("Black Marble")')).toHaveCount(0);
  });

  test("Decorative Partitions -> Wall Panels: a style valid in both ('Black') is preserved, not cleared", async ({
    page,
  }) => {
    await goThroughToStyle(page, "Decorative Partitions");
    await funnel.selectStyleAndMaterial(page, "Black", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");

    await page.goto("/");
    await page.click('a:has-text("Wall Panels")');
    await page.waitForURL(/service=wall-panels/);
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/photo");
    await funnel.skipPhoto(page);
    await page.waitForURL("**/quote/style");

    // "Black" is a legitimate style for Wall Panels too — should remain selected.
    await expect(page.locator('button:has-text("Black")[aria-pressed="true"]')).toBeVisible();
  });
});

test.describe("Server-side rejection of impossible service+style combinations", () => {
  test("a tampered request pairing Wall Panels with a Wallpaper-only style is rejected", async ({ baseURL }) => {
    const sessionId = `h02-tamper-1-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "wall-panels",
      styleId: "botanical",
      currentStep: "STYLE",
    });
    expect(result.status).toBe(400);
    expect(result.json?.ok).toBe(false);
  });

  test("a tampered request pairing Marble Sheets with a wood-toned style is rejected", async ({ baseURL }) => {
    const sessionId = `h02-tamper-2-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "marble-sheets",
      styleId: "light-oak",
      currentStep: "STYLE",
    });
    expect(result.status).toBe(400);
  });

  test("a style submitted before any service is set is rejected (no service to validate against)", async ({
    baseURL,
  }) => {
    const sessionId = `h02-tamper-3-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      styleId: "geometric",
      currentStep: "STYLE",
    });
    expect(result.status).toBe(400);
  });

  test("a valid service+style combination is accepted", async ({ baseURL }) => {
    const sessionId = `h02-valid-1-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "decorative-partitions",
      styleId: "wood-slat",
      currentStep: "STYLE",
    });
    expect(result.status).toBe(200);
    expect(result.json?.ok).toBe(true);
  });

  test("style set in an earlier call becomes invalid once a later call changes the service — rejected", async ({
    baseURL,
  }) => {
    const sessionId = `h02-cross-call-${Date.now()}`;
    const first = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "wall-panels",
      styleId: "dark-walnut",
      currentStep: "STYLE",
    });
    expect(first.status).toBe(200);

    // Second call changes only the service, without resending styleId —
    // the server must validate against the now-effective combination
    // (new serviceSlug + previously-persisted styleId), not just this
    // request's own fields in isolation.
    const second = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      serviceSlug: "wallpaper",
      currentStep: "STYLE",
    });
    expect(second.status).toBe(400);
  });
});
