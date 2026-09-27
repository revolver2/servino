import { chromium } from "playwright-core";
import fs from "node:fs";

const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const BASE = "http://localhost:3000";
const [adminEmail, adminPassword, proEmail, proPassword, jobId, freshSessionId, confirmToken] = process.argv.slice(2);

async function checkPage(page, url, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await globalThis.axe.run());
  console.log(`\n=== ${label} (${url}) ===`);
  console.log(`Violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
  }
  return results.violations.length;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let total = 0;

  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const custPage = await custCtx.newPage();
  total += await checkPage(custPage, `${BASE}/`, "Homepage");
  total += await checkPage(custPage, `${BASE}/toronto/wall-makeover`, "Toronto landing");
  total += await checkPage(custPage, `${BASE}/quote/project`, "Quote entry");

  await custPage.evaluate((sid) => localStorage.setItem("servino_session_id", JSON.stringify(sid)), freshSessionId);
  total += await checkPage(custPage, `${BASE}/quote/payment`, "Checkout (payment)");

  if (confirmToken) {
    total += await checkPage(custPage, `${BASE}/confirm?token=${confirmToken}`, "Completion confirmation");
  }

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${BASE}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });
  total += await checkPage(adminPage, `${BASE}/admin/launch`, "Admin Launch dashboard");
  total += await checkPage(adminPage, `${BASE}/admin/payments`, "Admin Payments list");

  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  total += await checkPage(proPage, `${BASE}/pro/jobs/${jobId}`, "Professional job detail (payout status)");

  await browser.close();
  console.log(`\nTOTAL VIOLATIONS: ${total}`);
  if (total > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
