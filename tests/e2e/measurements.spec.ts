import { test, expect } from "@playwright/test";
import { apiPost } from "./helpers/api";
import * as funnel from "./helpers/funnel";

test.describe("Measurement edge cases — client-side (UI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/quote/project");
    await funnel.selectService(page, "Wall Panels");
    await funnel.enterLocation(page, "M5V 2T6");
    await page.waitForURL("**/quote/measurements");
  });

  test("zero and negative values are rejected with visible errors", async ({ page }) => {
    await funnel.fillWall(page, 0, "0", "-2");
    await page.click('button:has-text("Continue")');
    await expect(page.locator("text=Must be greater than 0")).toHaveCount(2);
    await expect(page).toHaveURL(/measurements$/);
  });

  test("validation error text uses the accessible coral shade, not the low-contrast one (Session F pre-check, spec section 9)", async ({
    page,
  }) => {
    // The original `text-coral` (#ff6b57) measures ~2.8:1 on white — below
    // WCAG AA's 4.5:1 for normal text. Session E introduced `text-coral-text`
    // (#a8301f, >5:1) for exactly this purpose but only applied it to new
    // admin economics UI; this funnel error text was flagged as a known,
    // pre-existing, narrowly-scoped, presentation-only gap and fixed here
    // (docs/DECISIONS.md D031) without any behavior change.
    await funnel.fillWall(page, 0, "0", "-2");
    await page.click('button:has-text("Continue")');
    const errorText = page.locator("text=Must be greater than 0").first();
    const className = await errorText.getAttribute("class");
    expect(className).toContain("text-coral-text");
    expect(className?.split(/\s+/)).not.toContain("text-coral");
  });

  test("extremely large values are rejected", async ({ page }) => {
    await funnel.fillWall(page, 0, "500", "500");
    await page.click('button:has-text("Continue")');
    await expect(page.locator("text=/too large/i").first()).toBeVisible();
    await expect(page).toHaveURL(/measurements$/);
  });

  test("missing height blocks continue with a visible error", async ({ page }) => {
    const widths = await page.$$('input[id^="width-"]');
    await widths[0].fill("3");
    await page.click('button:has-text("Continue")');
    await expect(page.locator("text=Required").first()).toBeVisible();
    await expect(page).toHaveURL(/measurements$/);
  });

  test("decimal values compute area correctly", async ({ page }) => {
    await funnel.fillWall(page, 0, "3.3", "2.7");
    // 3.3 * 2.7 = 8.91
    await expect(page.locator("text=Area: 8.91 m²")).toBeVisible();
  });

  test("imperial measurement converts to m² correctly (10ft x 8ft = 7.43 m²)", async ({ page }) => {
    await page.click('button:has-text("Imperial (ft)")');
    await funnel.fillWall(page, 0, "10", "8");
    await expect(page.locator("text=Area: 7.43 m²")).toBeVisible();
  });

  test("switching units converts already-entered dimensions instead of clearing them (10ft x 8ft -> metric)", async ({
    page,
  }) => {
    await page.click('button:has-text("Imperial (ft)")');
    await funnel.fillWall(page, 0, "10", "8");
    await page.click('button:has-text("Metric (m)")');

    const widthInput = page.locator('input[id^="width-"]').first();
    const heightInput = page.locator('input[id^="height-"]').first();
    // 10ft -> ~3.05m, 8ft -> ~2.44m — populated, not cleared to empty.
    await expect(widthInput).not.toHaveValue("");
    await expect(heightInput).not.toHaveValue("");
    const width = Number(await widthInput.inputValue());
    const height = Number(await heightInput.inputValue());
    expect(width).toBeCloseTo(3.05, 1);
    expect(height).toBeCloseTo(2.44, 1);

    // Area stays physically equivalent (~7.43 m², small rounding tolerance
    // from converting each dimension independently) — not zeroed out.
    const totalAreaText = await page.locator("span.text-lg").first().textContent();
    const totalArea = Number(totalAreaText?.replace(/[^0-9.]/g, ""));
    expect(totalArea).toBeGreaterThan(7.3);
    expect(totalArea).toBeLessThan(7.6);
  });

  test("round trip Imperial -> Metric -> Imperial approximately restores the original dimensions", async ({ page }) => {
    await page.click('button:has-text("Imperial (ft)")');
    await funnel.fillWall(page, 0, "10", "8");
    await page.click('button:has-text("Metric (m)")');
    await page.click('button:has-text("Imperial (ft)")');

    const widthInput = page.locator('input[id^="width-"]').first();
    const heightInput = page.locator('input[id^="height-"]').first();
    const width = Number(await widthInput.inputValue());
    const height = Number(await heightInput.inputValue());
    // Within 0.1 ft of the original 10/8 — no meaningful drift.
    expect(width).toBeCloseTo(10, 0);
    expect(height).toBeCloseTo(8, 0);
  });

  test("an empty field stays empty (not 0, not NaN) after a unit switch", async ({ page }) => {
    const widths = await page.$$('input[id^="width-"]');
    await widths[0].fill("10");
    // Height deliberately left blank.
    await page.click('button:has-text("Imperial (ft)")');

    const widthInput = page.locator('input[id^="width-"]').first();
    const heightInput = page.locator('input[id^="height-"]').first();
    await expect(widthInput).not.toHaveValue("");
    await expect(widthInput).not.toHaveValue("NaN");
    await expect(heightInput).toHaveValue("");
  });

  test("decimal values convert cleanly, no NaN/Infinity anywhere on the page", async ({ page }) => {
    await funnel.fillWall(page, 0, "3.3", "2.7");
    await page.click('button:has-text("Imperial (ft)")');
    await page.click('button:has-text("Metric (m)")');

    const widthInput = page.locator('input[id^="width-"]').first();
    const heightInput = page.locator('input[id^="height-"]').first();
    const width = Number(await widthInput.inputValue());
    const height = Number(await heightInput.inputValue());
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/NaN/);
    expect(bodyText).not.toMatch(/Infinity/);
  });

  test("repeated unit switching never corrupts values into NaN/Infinity/negative", async ({ page }) => {
    await funnel.fillWall(page, 0, "3", "2.5");
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Imperial (ft)")');
      await page.click('button:has-text("Metric (m)")');
    }

    const widthInput = page.locator('input[id^="width-"]').first();
    const heightInput = page.locator('input[id^="height-"]').first();
    const width = Number(await widthInput.inputValue());
    const height = Number(await heightInput.inputValue());
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // No meaningful drift after four round trips.
    expect(width).toBeCloseTo(3, 0);
    expect(height).toBeCloseTo(2.5, 0);
  });

  test("multiple walls sum correctly (3x2.5 + 2x2 = 11.5 m²)", async ({ page }) => {
    await funnel.fillWall(page, 0, "3", "2.5");
    await funnel.addWall(page);
    await funnel.fillWall(page, 1, "2", "2");
    await expect(page.locator("span.text-lg").first()).toHaveText("11.5 m²");
  });
});

test.describe("Measurement edge cases — server-side (API)", () => {
  test("negative totalAreaM2 is rejected by the server regardless of client validation", async ({ baseURL }) => {
    const sessionId = `phase-c-neg-area-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      totalAreaM2: -5,
      currentStep: "MEASUREMENTS",
    });
    expect(result.status).toBe(400);
    expect(result.json?.ok).toBe(false);
  });

  test("absurdly large totalAreaM2 is rejected by the server", async ({ baseURL }) => {
    const sessionId = `phase-c-huge-area-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      totalAreaM2: 999999999,
      currentStep: "MEASUREMENTS",
    });
    expect(result.status).toBe(400);
  });

  test("zero totalAreaM2 is rejected by the server (positive() bound)", async ({ baseURL }) => {
    const sessionId = `phase-c-zero-area-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      totalAreaM2: 0,
      currentStep: "MEASUREMENTS",
    });
    // Zod's z.number().positive() rejects exactly 0.
    expect(result.status).toBe(400);
  });

  test("malformed (non-numeric) totalAreaM2 is rejected by the server", async ({ baseURL }) => {
    const sessionId = `phase-c-malformed-area-${Date.now()}`;
    const result = await apiPost(baseURL!, "/api/lead/progress", {
      sessionId,
      totalAreaM2: "not-a-number",
      currentStep: "MEASUREMENTS",
    });
    expect(result.status).toBe(400);
  });
});
