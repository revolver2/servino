// Responsive spot-check for Session G surfaces (customer 360/390/430/1440,
// professional 360/390/430/768, admin 768/1024/1440) — checks for
// horizontal overflow (the spec's explicit concern: no clipped financial
// actions) and captures a screenshot at each width.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const [outDir, adminEmail, adminPassword, proEmail, proPassword, sessionId, jobId, paymentId, payoutId] =
  process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function checkOverflow(page, label, width) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`${label} @ ${width}px — horizontal overflow: ${hasOverflow ? "YES (FAIL)" : "no"}`);
  return hasOverflow;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let anyOverflow = false;

  // ---- Customer checkout: 360/390/430/1440 ----
  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const custPage = await custCtx.newPage();
  await custPage.goto(`${BASE}/quote/project`, { waitUntil: "networkidle" });
  await custPage.evaluate((sid) => localStorage.setItem("servino_session_id", JSON.stringify(sid)), sessionId);
  for (const width of [360, 390, 430, 1440]) {
    await custPage.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await custPage.goto(`${BASE}/quote/payment`, { waitUntil: "networkidle" });
    await custPage.waitForSelector("text=Confirm and pay");
    anyOverflow ||= await checkOverflow(custPage, "customer /quote/payment", width);
    await custPage.screenshot({ path: path.join(outDir, `responsive-customer-checkout-${width}.png`), fullPage: true });
  }
  await custCtx.close();

  // ---- Professional job detail: 360/390/430/768 ----
  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  for (const width of [360, 390, 430, 768]) {
    await proPage.setViewportSize({ width, height: 844 });
    await proPage.goto(`${BASE}/pro/jobs/${jobId}`, { waitUntil: "networkidle" });
    anyOverflow ||= await checkOverflow(proPage, "pro job detail (payout status)", width);
    await proPage.screenshot({ path: path.join(outDir, `responsive-pro-job-${width}.png`), fullPage: true });
  }
  await proCtx.close();

  // ---- Admin payments/payouts: 768/1024/1440 ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${BASE}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });
  for (const width of [768, 1024, 1440]) {
    await adminPage.setViewportSize({ width, height: 900 });
    await adminPage.goto(`${BASE}/admin/payments/${paymentId}`, { waitUntil: "networkidle" });
    anyOverflow ||= await checkOverflow(adminPage, "admin payment detail", width);
    await adminPage.screenshot({ path: path.join(outDir, `responsive-admin-payment-${width}.png`), fullPage: true });

    await adminPage.goto(`${BASE}/admin/payouts/${payoutId}`, { waitUntil: "networkidle" });
    anyOverflow ||= await checkOverflow(adminPage, "admin payout detail", width);
    await adminPage.screenshot({ path: path.join(outDir, `responsive-admin-payout-${width}.png`), fullPage: true });
  }
  await adminCtx.close();

  await browser.close();
  if (anyOverflow) {
    console.error("\nFAIL — horizontal overflow detected at one or more breakpoints.");
    process.exit(1);
  }
  console.log("\nPASS — no horizontal overflow at any checked breakpoint.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
