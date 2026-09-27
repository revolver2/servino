import { chromium } from "playwright-core";
import fs from "node:fs";

const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const BASE = "http://localhost:3000";
const [sessionId] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
  await page.evaluate((sid) => localStorage.setItem("servino_session_id", JSON.stringify(sid)), sessionId);
  await page.goto(`${BASE}/quote/payment`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Confirm and pay");
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await globalThis.axe.run());
  console.log(`\n=== Customer Checkout /quote/payment ===`);
  console.log(`Violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
