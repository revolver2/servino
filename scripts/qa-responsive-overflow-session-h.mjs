// Session H — responsive breakpoint overflow check (spec section 93).
// Checks document.scrollWidth vs window.innerWidth (horizontal overflow)
// at every required breakpoint for each surface (Customer / Professional /
// Admin), including the new /admin/launch dashboard.
// Usage: node scripts/qa-responsive-overflow-session-h.mjs <adminEmail> <adminPassword> <proEmail> <proPassword> <jobId> <freshSessionId> <confirmToken>
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const [adminEmail, adminPassword, proEmail, proPassword, jobId, freshSessionId, confirmToken] = process.argv.slice(2);

async function checkOverflow(page, url, width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle" });
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  const overflow = scrollWidth - innerWidth;
  const status = overflow > 1 ? `OVERFLOW +${overflow}px` : "OK";
  console.log(`[${status}] ${label} @ ${width}px — ${url} (scrollWidth=${scrollWidth}, innerWidth=${innerWidth})`);
  return overflow > 1;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let anyOverflow = false;

  const customerSizes = [360, 390, 430, 768, 1440];
  const proSizes = [360, 390, 430, 768];
  const adminSizes = [768, 1024, 1440];

  const custCtx = await browser.newContext();
  const custPage = await custCtx.newPage();
  for (const w of customerSizes) {
    anyOverflow ||= await checkOverflow(custPage, `${BASE}/`, w, "Homepage");
    anyOverflow ||= await checkOverflow(custPage, `${BASE}/toronto/wall-makeover`, w, "Toronto landing");
    anyOverflow ||= await checkOverflow(custPage, `${BASE}/quote/project`, w, "Quote entry");
  }
  await custPage.evaluate((sid) => localStorage.setItem("servino_session_id", JSON.stringify(sid)), freshSessionId);
  for (const w of customerSizes) {
    anyOverflow ||= await checkOverflow(custPage, `${BASE}/quote/payment`, w, "Checkout (payment)");
  }
  if (confirmToken) {
    for (const w of customerSizes) {
      anyOverflow ||= await checkOverflow(custPage, `${BASE}/confirm?token=${confirmToken}`, w, "Completion confirmation");
    }
  }
  await custCtx.close();

  const proCtx = await browser.newContext();
  const proPage = await proCtx.newPage();
  await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  for (const w of proSizes) {
    anyOverflow ||= await checkOverflow(proPage, `${BASE}/pro/jobs/${jobId}`, w, "Professional job detail");
    anyOverflow ||= await checkOverflow(proPage, `${BASE}/pro/jobs`, w, "Professional job list");
  }
  await proCtx.close();

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.request.post(`${BASE}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });
  for (const w of adminSizes) {
    anyOverflow ||= await checkOverflow(adminPage, `${BASE}/admin/launch`, w, "Admin Launch dashboard");
    anyOverflow ||= await checkOverflow(adminPage, `${BASE}/admin/payments`, w, "Admin Payments list");
    anyOverflow ||= await checkOverflow(adminPage, `${BASE}/admin/jobs/${jobId}`, w, "Admin Job detail");
  }
  await adminCtx.close();

  await browser.close();
  console.log(anyOverflow ? "\nFAIL — horizontal overflow detected at one or more breakpoints." : "\nPASS — no horizontal overflow at any required breakpoint.");
  process.exit(anyOverflow ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
