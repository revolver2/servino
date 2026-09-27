// Session H0.1 — responsive overflow + axe-core accessibility check on
// every surface touched by this session's fixes.
// Usage: node scripts/qa-h01-responsive-a11y.mjs <base-url>
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const pages = ["/", "/toronto/wall-makeover", "/quote/project", "/privacy", "/terms", "/contact"];
const sizes = [360, 390, 430, 768, 1440];

async function checkOverflow(page, url, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  const overflow = scrollWidth - innerWidth;
  const status = overflow > 1 ? `OVERFLOW +${overflow}px` : "OK";
  console.log(`[${status}] ${url} @ ${width}px`);
  return overflow > 1;
}

async function checkAxe(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await globalThis.axe.run());
  console.log(`[axe] ${url}: ${results.violations.length} violation(s)`);
  for (const v of results.violations) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
  }
  return results.violations.length;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let anyOverflow = false;
  for (const url of pages) {
    for (const w of sizes) {
      anyOverflow ||= await checkOverflow(page, url, w);
    }
  }

  let totalViolations = 0;
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const url of pages) {
    totalViolations += await checkAxe(page, url);
  }

  await browser.close();
  console.log(`\nOverflow: ${anyOverflow ? "FAIL" : "PASS"}`);
  console.log(`Accessibility: ${totalViolations === 0 ? "PASS" : "FAIL"} (${totalViolations} total violations)`);
  process.exit(anyOverflow || totalViolations > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
