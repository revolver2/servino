// Captures the pricing-unavailable state screenshot. Requires the caller to
// have temporarily removed "decorative-partitions" from dev-pricing-config.ts
// beforehand, and to revert it immediately after this runs.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:3000";

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /decorative partitions/i }).click();
  await page.getByLabel(/postal code/i).fill("M5V 2T6");
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForURL(/\/quote\/measurements/);
  await page.locator('input[id^="width-"]').nth(0).fill("3");
  await page.locator('input[id^="height-"]').nth(0).fill("2");
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForURL(/\/quote\/photo/);
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.waitForURL(/\/quote\/style/);
  await page.getByRole("button", { name: /light oak/i }).click();
  await page.getByRole("button", { name: /i need material \+ installation/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForURL(/\/quote\/price/);
  await page.waitForSelector("text=/We couldn.t generate a price/i", { timeout: 15000 });
  await page.screenshot({ path: path.join(outDir, "10-pricing-failure.png") });
  console.log("captured 10-pricing-failure.png");

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
