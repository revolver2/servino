// Session H QA screenshot driver. Requires the target server already
// running against servino_dev with an admin account and real Session
// G/H data already present (job/payment/payout/professional IDs passed
// as arguments). Only captures states that actually exist.
// Usage: node scripts/qa-session-h-screenshots.mjs <output-dir> <base-url> <adminEmail> <adminPassword> <jobId> <paymentId> <payoutId> <proEmail> <proPassword> <freshSessionId>
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL, adminEmail, adminPassword, jobId, paymentId, payoutId, proEmail, proPassword, freshSessionId] =
  process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, file, width, height) {
  await page.setViewportSize({ width, height });
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log("captured", file);
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---- Customer mobile (390) ----
  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const custPage = await custCtx.newPage();
  await custPage.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await shot(custPage, "01-home-mobile.png", 390, 844);

  await custPage.goto(`${baseURL}/toronto/wall-makeover`, { waitUntil: "networkidle" });
  await shot(custPage, "02-toronto-landing-mobile.png", 390, 844);

  await custPage.goto(`${baseURL}/quote/project`, { waitUntil: "networkidle" });
  await shot(custPage, "03-quote-mobile.png", 390, 844);

  // Fresh unpaid session for the checkout screenshot.
  await custPage.evaluate((sid) => localStorage.setItem("servino_session_id", JSON.stringify(sid)), freshSessionId);
  await custPage.goto(`${baseURL}/quote/payment`, { waitUntil: "networkidle" });
  await custPage.waitForSelector("text=Confirm and pay");
  await shot(custPage, "04-payment-mobile.png", 390, 844);
  await custCtx.close();

  // ---- Admin desktop (1440) ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${baseURL}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });

  await adminPage.goto(`${baseURL}/admin/launch`, { waitUntil: "networkidle" });
  await shot(adminPage, "06-admin-launch-1-job.png", 1440, 1000);

  await adminPage.goto(`${baseURL}/admin/payments/${paymentId}`, { waitUntil: "networkidle" });
  await shot(adminPage, "08-admin-payment.png", 1440, 1100);

  await adminPage.goto(`${baseURL}/admin/jobs/${jobId}`, { waitUntil: "networkidle" });
  await shot(adminPage, "09-admin-job.png", 1440, 2000);
  await adminCtx.close();

  // ---- Professional mobile (390) ----
  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${baseURL}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  await proPage.goto(`${baseURL}/pro/jobs/${jobId}`, { waitUntil: "networkidle" });
  await shot(proPage, "10-pro-job.png", 390, 900);
  await proCtx.close();

  await browser.close();
  console.log("Session H screenshots done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
