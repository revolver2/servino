import { chromium } from "playwright-core";
import fs from "node:fs";

const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const BASE = "http://localhost:3000";
const [adminEmail, adminPassword, proEmail, proPassword, jobId, paymentId, payoutId, completableJobId] =
  process.argv.slice(2);

async function checkPage(page, url, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await globalThis.axe.run());
  console.log(`\n=== ${label} (${url}) ===`);
  console.log(`Violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---- Admin pages (desktop) ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${BASE}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });

  // ---- Customer pages (mobile) — fresh completion-confirmation token generated via the admin session.
  const tokenRes = await adminPage.request.post(`${BASE}/api/admin/jobs/${completableJobId}/completion-token`);
  const tokenBody = await tokenRes.json();
  const confirmToken = new URL(`${BASE}${tokenBody.data.confirmPath}`).searchParams.get("token");
  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const custPage = await custCtx.newPage();
  await checkPage(custPage, `${BASE}/confirm?token=${confirmToken}`, "Customer completion confirmation");

  await checkPage(adminPage, `${BASE}/admin/payments`, "Admin Payments List");
  await checkPage(adminPage, `${BASE}/admin/payments/${paymentId}`, "Admin Payment Detail");
  await checkPage(adminPage, `${BASE}/admin/payouts`, "Admin Payouts List");
  await checkPage(adminPage, `${BASE}/admin/payouts/${payoutId}`, "Admin Payout Detail");
  await checkPage(adminPage, `${BASE}/admin/jobs/${jobId}`, "Admin Job Detail (with Payment/Payout cards)");

  // ---- Professional pages (mobile) ----
  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  await checkPage(proPage, `${BASE}/pro/jobs/${jobId}`, "Pro Job Detail (payout status shown)");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
