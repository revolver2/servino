import { chromium } from "playwright-core";
import fs from "node:fs";

const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const BASE = "http://localhost:3000";
const [adminEmail, adminPassword, proEmail, proPassword, offeredJobId, assignedJobId, completedJobId, professionalId] =
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

  // ---- Admin pages ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${BASE}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });
  await checkPage(adminPage, `${BASE}/admin/jobs/${offeredJobId}`, "Admin Job Detail (OFFERED)");
  await checkPage(adminPage, `${BASE}/admin/jobs/${assignedJobId}`, "Admin Job Detail (ASSIGNED)");
  await checkPage(adminPage, `${BASE}/admin/jobs/${completedJobId}`, "Admin Job Detail (COMPLETED, with problem report)");
  await checkPage(adminPage, `${BASE}/admin/professionals/${professionalId}`, "Admin Professional Detail");

  // ---- Professional pages ----
  await checkPage(adminPage, `${BASE}/pro/login`, "Pro Login (unauthenticated)");

  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  await checkPage(proPage, `${BASE}/pro`, "Pro Home");
  await checkPage(proPage, `${BASE}/pro/jobs`, "Pro Jobs List");
  await checkPage(proPage, `${BASE}/pro/jobs/${offeredJobId}`, "Pro Job Detail (OFFERED)");
  await checkPage(proPage, `${BASE}/pro/jobs/${completedJobId}`, "Pro Job Detail (COMPLETED)");
  await checkPage(proPage, `${BASE}/pro/profile`, "Pro Profile");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
