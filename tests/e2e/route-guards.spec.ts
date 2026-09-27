import { test, expect } from "@playwright/test";

/**
 * Every funnel step must refuse to render its "reached" state for a
 * fresh session with no prior progress — either redirecting to the
 * correct prerequisite step or showing an explicit safe state. No step
 * may fabricate missing data (spec section 7 / this phase's section 7–8).
 */

const guardedRedirects: { path: string; expectRedirectTo: RegExp }[] = [
  { path: "/quote/measurements", expectRedirectTo: /\/quote\/project$/ },
  { path: "/quote/photo", expectRedirectTo: /\/quote\/project$/ },
  { path: "/quote/style", expectRedirectTo: /\/quote\/project$/ },
  { path: "/quote/price", expectRedirectTo: /\/quote\/project$/ },
  { path: "/quote/contact", expectRedirectTo: /\/quote\/project$/ },
  { path: "/quote/timing", expectRedirectTo: /\/quote\/project$/ },
];

for (const { path, expectRedirectTo } of guardedRedirects) {
  test(`fresh session accessing ${path} redirects to a valid prerequisite step`, async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(path);
    await page.waitForURL(expectRedirectTo, { timeout: 5_000 });
    expect(page.url()).toMatch(expectRedirectTo);
  });
}

test("quote funnel progress indicator has an accessible name (regression: Lighthouse a11y P1 found in Phase C)", async ({
  page,
}) => {
  await page.goto("/quote/project");
  await expect(page.getByRole("progressbar", { name: "Quote progress" })).toBeVisible();
});

test.describe("CRITICAL — /quote/confirmation must never fabricate success", () => {
  test("fresh browser context shows 'not found', never a submitted-project confirmation", async ({
    page,
  }) => {
    await page.goto("/quote/confirmation");
    await page.waitForSelector("text=No submitted project found", { timeout: 10_000 });

    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("No submitted project found");
    expect(bodyText).not.toContain("Your project request is in");

    // A restart option must be offered — never a dead end presented as success.
    await expect(page.locator('a:has-text("Start a new project")')).toBeVisible();
  });

  test("query-parameter manipulation does not force a success state", async ({ page }) => {
    await page.goto("/quote/confirmation?success=true&status=confirmed&paid=true");
    await page.waitForSelector("text=No submitted project found", { timeout: 10_000 });
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("Your project request is in");
  });
});
