// Session E QA — customer-facing quote price page at the responsive
// widths required by the spec (360 / 390 / 430 / 1440), driven through the
// real funnel UI (not the API directly) against an authoritative pricing
// version so the screenshot reflects real production-shaped numbers.
// Usage: node scripts/qa-session-e-customer-price.mjs <output-dir> <base-url>
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const WIDTHS = [
  { width: 360, height: 800, label: "360" },
  { width: 390, height: 844, label: "390" },
  { width: 430, height: 932, label: "430" },
  { width: 1440, height: 900, label: "1440" },
];

async function driveToPricePage(page) {
  await page.goto(`${baseURL}/toronto/wall-makeover`);
  await page.locator('a[href="/quote"]:has-text("Get My Price")').first().click();
  await page.waitForURL("**/quote/project");

  await page.click('button:has-text("Wall Panels")');
  await page.fill("#postal-code", "M5V 2T6");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/measurements");

  const widths = await page.$$('input[id^="width-"]');
  const heights = await page.$$('input[id^="height-"]');
  await widths[0].fill("3");
  await heights[0].fill("2.5");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/photo");

  await page.click('button:has-text("Skip for now")');
  await page.waitForURL("**/quote/style");

  await page.click('button:has-text("Dark Walnut")');
  await page.click('button:has-text("I need material + installation")');
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/price");
  await page.waitForSelector("text=Total (incl. tax)");
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  for (const vp of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await driveToPricePage(page);
    await page.screenshot({ path: path.join(outDir, `customer-price-${vp.label}.png`), fullPage: true });
    console.log("captured", `customer-price-${vp.label}.png`);
    await context.close();
  }

  await browser.close();
  console.log("Customer price screenshots done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
