import { test, expect } from "@playwright/test";
import * as funnel from "./helpers/funnel";

/**
 * Session H0.1 — regression coverage for the service-card preselection
 * bug: clicking a service card on the homepage must select that exact
 * service in the quote funnel, even when a stale previous session
 * already has a different service selected. An explicit, just-clicked
 * selection always wins over old session state.
 */
test.describe("Homepage service card preselection", () => {
  const services = [
    { card: "Wall Panels", slug: "wall-panels" },
    { card: "Marble Sheets", slug: "marble-sheets" },
    { card: "Wallpaper", slug: "wallpaper" },
    { card: "Decorative Partitions", slug: "decorative-partitions" },
  ];

  for (const { card, slug } of services) {
    test(`clicking "${card}" on the homepage preselects it in the quote funnel`, async ({ page }) => {
      await page.goto("/");
      await page.click(`a:has-text("${card}")`);
      await expect(page).toHaveURL(new RegExp(`/quote/project\\?service=${slug}`));
      await expect(page.locator(`button:has-text("${card}")[aria-pressed="true"]`)).toBeVisible();
    });
  }

  test("an explicit new selection overrides a stale previous-session service (Wall Panels -> Wallpaper)", async ({
    page,
  }) => {
    // Establish a real session with Wall Panels already selected.
    await page.goto("/quote/project");
    await funnel.selectService(page, "Wall Panels");
    await funnel.enterLocation(page, "M5V 2T6");
    await expect(page).toHaveURL(/measurements$/);

    // Return to the homepage and click a different card.
    await page.goto("/");
    await page.click('a:has-text("Wallpaper")');

    await expect(page).toHaveURL(/\/quote\/project\?service=wallpaper/);
    await expect(page.locator('button:has-text("Wallpaper")[aria-pressed="true"]')).toBeVisible();
    await expect(page.locator('button:has-text("Wall Panels")[aria-pressed="true"]')).toHaveCount(0);
  });

  test("a second override also wins (Wallpaper -> Marble Sheets)", async ({ page }) => {
    await page.goto("/quote/project");
    await funnel.selectService(page, "Wallpaper");
    await funnel.enterLocation(page, "M5V 2T6");
    await expect(page).toHaveURL(/measurements$/);

    await page.goto("/");
    await page.click('a:has-text("Marble Sheets")');

    await expect(page).toHaveURL(/\/quote\/project\?service=marble-sheets/);
    await expect(page.locator('button:has-text("Marble Sheets")[aria-pressed="true"]')).toBeVisible();
    await expect(page.locator('button:has-text("Wallpaper")[aria-pressed="true"]')).toHaveCount(0);
  });

  test("continuing after an override persists the newly-selected service, not the stale one", async ({ page }) => {
    await page.goto("/quote/project");
    await funnel.selectService(page, "Wall Panels");
    await funnel.enterLocation(page, "M5V 2T6");

    await page.goto("/");
    await page.click('a:has-text("Wallpaper")');
    await funnel.enterLocation(page, "M5V 2T6");
    await expect(page).toHaveURL(/measurements$/);

    // Confirm it actually persisted server-side, not just client display —
    // go all the way to price and check the priced service.
    await funnel.fillWall(page, 0, "3", "2.5");
    await page.click('button:has-text("Continue")');
    await funnel.skipPhoto(page);
    await funnel.selectStyleAndMaterial(page, "Neutral", "I already have it");
    await page.click('button:has-text("Continue")');
    await page.waitForURL("**/quote/price");
    await expect(page.locator("text=Wallpaper")).toBeVisible();
    await expect(page.locator("text=Wall Panels")).toHaveCount(0);
  });
});
