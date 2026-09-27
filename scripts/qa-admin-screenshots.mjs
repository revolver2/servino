// Session D admin QA screenshot driver. Requires the target server already
// running and an admin account already bootstrapped for the given creds.
// Usage: node scripts/qa-admin-screenshots.mjs <output-dir> <base-url> <email> <password> [leadId] [jobUnassignedId] [jobAssignedId] [professionalId]
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL, email, password, leadId, jobUnassignedId, jobAssignedId, professionalId] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, file) {
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log("captured", file);
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 01 — login page (unauthenticated)
  await page.goto(`${baseURL}/admin/login`, { waitUntil: "networkidle" });
  await shot(page, "01-admin-login.png");

  // Log in for the rest.
  const res = await page.request.post(`${baseURL}/api/admin/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);

  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await shot(page, "02-admin-overview.png");

  await page.goto(`${baseURL}/admin/leads`, { waitUntil: "networkidle" });
  await shot(page, "03-leads-list.png");

  if (leadId) {
    await page.goto(`${baseURL}/admin/leads/${leadId}`, { waitUntil: "networkidle" });
    await shot(page, "04-lead-detail.png");
  }

  await page.goto(`${baseURL}/admin/jobs`, { waitUntil: "networkidle" });
  await shot(page, "05-jobs-list.png");

  if (jobUnassignedId) {
    await page.goto(`${baseURL}/admin/jobs/${jobUnassignedId}`, { waitUntil: "networkidle" });
    await shot(page, "06-job-detail-unassigned.png");
  }
  if (jobAssignedId) {
    await page.goto(`${baseURL}/admin/jobs/${jobAssignedId}`, { waitUntil: "networkidle" });
    await shot(page, "07-job-detail-assigned.png");
  }

  await page.goto(`${baseURL}/admin/professionals`, { waitUntil: "networkidle" });
  await shot(page, "08-professionals-list.png");

  if (professionalId) {
    await page.goto(`${baseURL}/admin/professionals/${professionalId}`, { waitUntil: "networkidle" });
    await shot(page, "09-professional-detail.png");
  }

  await page.goto(`${baseURL}/admin/services`, { waitUntil: "networkidle" });
  await shot(page, "10-services.png");

  // Responsive spot checks (spec section 50): 768 and 390.
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await shot(page, "11-overview-768.png");
  await page.goto(`${baseURL}/admin/jobs`, { waitUntil: "networkidle" });
  await shot(page, "12-jobs-list-768.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await shot(page, "13-overview-390.png");

  await browser.close();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
