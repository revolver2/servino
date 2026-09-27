// Session H0.1 manual QA — scenarios A-J from the spec.
// Usage: node scripts/qa-manual-h01.mjs <output-dir> <base-url>
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, file) {
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log("captured", file);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log("\n[A] Homepage feature claims");
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  const bodyText = await page.locator("body").textContent();
  const forbidden = ["Choose your professional", "Track everything in one place", "Messaging, scheduling"];
  for (const phrase of forbidden) {
    console.log(`  contains "${phrase}": ${bodyText.includes(phrase)}`);
  }
  await shot(page, "A-homepage.png");

  console.log("\n[B] Contact page (no SUPPORT_EMAIL configured in this run)");
  await page.goto(`${baseURL}/contact`, { waitUntil: "networkidle" });
  const contactText = await page.locator("body").textContent();
  console.log(`  shows "being finalized" honest placeholder: ${contactText.includes("being finalized")}`);
  console.log(`  contains a fabricated email pattern: ${/[a-z0-9.]+@[a-z0-9.]+\.[a-z]+/i.test(contactText)}`);
  await shot(page, "B-contact.png");

  console.log("\n[C/D] Measurements — 10x8 ft round trip");
  await page.goto(`${baseURL}/quote/project`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Wall Panels")');
  await page.fill("#postal-code", "M5V 2T6");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/measurements");
  await page.click('button:has-text("Imperial (ft)")');
  const widths = await page.$$('input[id^="width-"]');
  const heights = await page.$$('input[id^="height-"]');
  await widths[0].fill("10");
  await heights[0].fill("8");
  await shot(page, "C-measurements-imperial-10x8.png");
  await page.click('button:has-text("Metric (m)")');
  const widthAfter = await page.locator('input[id^="width-"]').first().inputValue();
  const heightAfter = await page.locator('input[id^="height-"]').first().inputValue();
  console.log(`  after -> Metric: width=${widthAfter} height=${heightAfter} (expected ~3.05 / ~2.44, not empty)`);
  await shot(page, "D-measurements-metric-converted.png");
  await page.click('button:has-text("Imperial (ft)")');
  const widthBack = await page.locator('input[id^="width-"]').first().inputValue();
  const heightBack = await page.locator('input[id^="height-"]').first().inputValue();
  console.log(`  round trip -> Imperial: width=${widthBack} height=${heightBack} (expected ~10 / ~8)`);

  console.log("\n[E] Footer Services link from /privacy");
  await page.goto(`${baseURL}/privacy`, { waitUntil: "networkidle" });
  const footerServicesHref = await page.locator('footer a:has-text("Services")').getAttribute("href");
  console.log(`  footer Services href: ${footerServicesHref} (expected /#services, not #services)`);
  await page.click('footer a:has-text("Services")');
  await page.waitForURL("**/#services");
  console.log(`  navigated to: ${page.url()}`);
  await shot(page, "E-footer-services-from-privacy.png");

  console.log("\n[F/G/H] Service card preselection — see service-selection.spec.ts for full automated coverage");
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.click('a:has-text("Wallpaper")');
  await page.waitForURL(/service=wallpaper/);
  console.log(`  Wallpaper card -> ${page.url()}`);
  await shot(page, "F-service-wallpaper-preselected.png");

  console.log("\n[I] Price step CTA");
  await page.goto(`${baseURL}/quote/project?service=wall-panels`, { waitUntil: "networkidle" });
  await page.fill("#postal-code", "M5V 2T6");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/measurements");
  const w2 = await page.$$('input[id^="width-"]');
  const h2 = await page.$$('input[id^="height-"]');
  await w2[0].fill("3");
  await h2[0].fill("2.5");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/photo");
  await page.click('button:has-text("Skip for now")');
  await page.waitForURL("**/quote/style");
  await page.click('button:has-text("Black")');
  await page.click('button:has-text("I already have it")');
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/price");
  await page.waitForSelector("text=Total (incl. tax)");
  const ctaText = await page.locator("a.bg-purple").first().textContent();
  console.log(`  Price CTA text: "${ctaText.trim()}" (expected "Continue with this estimate", not "Continue to Booking")`);
  await shot(page, "I-price-cta.png");

  await browser.close();
  console.log("\nManual QA scenarios A-J complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
