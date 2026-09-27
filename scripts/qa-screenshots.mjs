// One-off QA screenshot driver for docs/qa/{baseline-s2,post-s2}.
// Usage: node scripts/qa-screenshots.mjs <output-dir>
// Requires the dev server already running on http://localhost:3000.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node scripts/qa-screenshots.mjs <output-dir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 390, height: 844 };

async function shot(page, file) {
  await page.screenshot({ path: path.join(outDir, file) });
  console.log("captured", file);
}

async function newSession(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  return { context, page };
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // --- Session A: 01-04, 05a, 06-08 ---
  {
    const { context, page } = await newSession(browser);
    await page.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /wall panels/i }).click();
    await page.getByLabel(/postal code/i).fill("M5V 2T6");
    await shot(page, "01-project-location.png");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/measurements/);

    const widthInputs = page.locator('input[id^="width-"]');
    const heightInputs = page.locator('input[id^="height-"]');
    await widthInputs.nth(0).fill("3");
    await heightInputs.nth(0).fill("2.5");
    await page.getByRole("button", { name: /add another wall/i }).click();
    await widthInputs.nth(1).fill("2");
    await heightInputs.nth(1).fill("2");
    await shot(page, "02-measurements-two-walls.png");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/photo/);

    const fixture = path.join(process.cwd(), "tests/e2e/fixtures/test-photo.png");
    await page.setInputFiles('input[type="file"]', fixture);
    await shot(page, "03a-photo-uploaded.png");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/style/);

    await page.getByRole("button", { name: /light oak/i }).click();
    await page.getByRole("button", { name: /i need material \+ installation/i }).click();
    await shot(page, "04-style-material.png");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/price/);
    await page.waitForSelector("text=/Your Servino price/i");
    await shot(page, "05a-price-material-installation.png");
    await page.getByRole("link", { name: /continue to booking/i }).click();
    await page.waitForURL(/\/quote\/contact/);
    await shot(page, "06-contact.png");
    await page.getByLabel(/first name/i).fill("Jordan");
    await page.getByLabel(/^email$/i).fill("jordan@example.com");
    await page.getByLabel(/^phone$/i).fill("4165551234");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/timing/);
    await shot(page, "07-timing.png");
    await page.getByRole("button", { name: /within 1–2 weeks/i }).click();
    await page.getByRole("button", { name: /submit my project/i }).click();
    await page.waitForURL(/\/quote\/confirmation/);
    await page.waitForSelector("text=/Your project request is in/i");
    await shot(page, "08-confirmation.png");

    await context.close();
  }

  // --- Session B: 03b, 05b (separate branch: skip photo, install-only) ---
  {
    const { context, page } = await newSession(browser);
    await page.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /marble sheets/i }).click();
    await page.getByLabel(/postal code/i).fill("M4B 1B3");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/measurements/);
    await page.locator('input[id^="width-"]').nth(0).fill("2.4");
    await page.locator('input[id^="height-"]').nth(0).fill("3");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/photo/);
    await shot(page, "03b-photo-skipped.png");
    await page.getByRole("button", { name: /skip for now/i }).click();
    await page.waitForURL(/\/quote\/style/);
    await page.getByRole("button", { name: /^white$/i }).click();
    await page.getByRole("button", { name: /i already have it/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/price/);
    await page.waitForSelector("text=/Your Servino price/i");
    await shot(page, "05b-price-installation-only.png");
    await context.close();
  }

  // --- Session C: 09 validation error ---
  {
    const { context, page } = await newSession(browser);
    await page.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /wall panels/i }).click();
    await page.getByLabel(/postal code/i).fill("M5V 2T6");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/quote\/measurements/);
    await page.locator('input[id^="width-"]').nth(0).fill("0");
    await page.locator('input[id^="height-"]').nth(0).fill("-2");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await shot(page, "09-validation-error.png");
    await context.close();
  }

  await browser.close();
  console.log("Done. Screenshots in", outDir);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
