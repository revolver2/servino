import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const axeSource = fs.readFileSync(
  path.join("C:/Users/Moro/Desktop/servino/node_modules/axe-core/axe.min.js"),
  "utf8"
);

const BASE = "http://localhost:3000";

async function login(page) {
  await page.request.post(`${BASE}/api/admin/auth/login`, {
    data: { email: "owner@servino.local", password: "SessionEQaPassword123!" },
  });
}

async function checkPage(page, url, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => {
    return await globalThis.axe.run();
  });
  console.log(`\n=== ${label} (${url}) ===`);
  console.log(`Violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page);

  await checkPage(page, `${BASE}/admin/pricing`, "Admin Pricing Overview");
  await checkPage(page, `${BASE}/admin/pricing/cmue652vd0005fqzc2zzsmkwi`, "Admin Pricing Version Detail");
  await checkPage(page, `${BASE}/admin/pricing/simulator`, "Admin Pricing Simulator");
  await checkPage(page, `${BASE}/admin/pricing/new`, "Admin Pricing New Draft Form");
  await checkPage(page, `${BASE}/admin/jobs/cmue6hj0w0019fqzcrbw96kpn`, "Admin Job Detail (with economics)");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
