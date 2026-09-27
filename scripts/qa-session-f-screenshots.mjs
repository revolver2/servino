// Session F QA screenshot driver. Requires the target server already
// running against servino_dev with an admin account already bootstrapped.
// Creates its own professional + jobs via the real admin/customer/pro
// APIs and drives them through the full offer/field/decline/problem
// workflow, screenshotting each state along the way.
// Usage: node scripts/qa-session-f-screenshots.mjs <output-dir> <base-url> <adminEmail> <adminPassword>
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL, adminEmail, adminPassword] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, file, width = 390) {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log("captured", file);
}

async function post(page, path_, data) {
  const res = await page.request.post(`${baseURL}${path_}`, { data });
  const json = await res.json().catch(() => null);
  if (!res.ok()) throw new Error(`POST ${path_} failed: ${res.status()} ${JSON.stringify(json)}`);
  return json;
}

async function seedOfferedJob(adminPage, proId, sessionId, offerAmountMinor) {
  const ip = { "X-Forwarded-For": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
  await fetch(`${baseURL}/api/lead/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: JSON.stringify({
      sessionId,
      serviceSlug: "wall-panels",
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 10,
      styleId: "black",
      materialOwnership: "MATERIAL_AND_INSTALL",
      currentStep: "PRICE",
    }),
  });
  await fetch(`${baseURL}/api/lead/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: JSON.stringify({ sessionId }),
  });
  await fetch(`${baseURL}/api/lead/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: JSON.stringify({
      sessionId,
      firstName: "QaCustomer",
      email: `${sessionId}@example.com`,
      phone: "4165550099",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    }),
  });
  await fetch(`${baseURL}/api/lead/timing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: JSON.stringify({ sessionId, value: "ASAP" }),
  });
  await fetch(`${baseURL}/api/lead/booking-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: JSON.stringify({ sessionId }),
  });

  // Resolve the job id via the admin session (server-rendered leads/jobs list has no JSON API,
  // so we fetch the lead detail via a lightweight admin page fetch instead).
  const leadsPage = await adminPage.request.get(`${baseURL}/admin/jobs?q=${encodeURIComponent(sessionId)}`);
  const html = await leadsPage.text();
  const match = html.match(/\/admin\/jobs\/([a-z0-9]+)/);
  if (!match) throw new Error(`Could not resolve job id for session ${sessionId}`);
  const jobId = match[1];

  await post(adminPage, `/api/admin/jobs/${jobId}/status`, { status: "REVIEWING" });
  await post(adminPage, `/api/admin/jobs/${jobId}/status`, { status: "READY_FOR_ASSIGNMENT" });
  await post(adminPage, `/api/admin/jobs/${jobId}/offer`, { professionalId: proId, offerAmountMinor });
  return jobId;
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---- Admin setup context ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const loginRes = await adminPage.request.post(`${baseURL}/api/admin/auth/login`, {
    data: { email: adminEmail, password: adminPassword },
  });
  if (!loginRes.ok()) throw new Error(`admin login failed: ${loginRes.status()}`);

  const stamp = Date.now();
  const proEmail = `qa-session-f-pro-${stamp}@example.com`;
  const createPro = await post(adminPage, "/api/admin/professionals", {
    displayName: "QA Session F Pro",
    email: proEmail,
    phone: "4165550100",
    serviceSlugs: ["wall-panels"],
    verificationStatus: "VERIFIED",
  });
  const proId = createPro.data.id;

  const activation = await post(adminPage, `/api/admin/professionals/${proId}/activation`, {});
  const token = new URL(`${baseURL}${activation.data.activationPath}`).searchParams.get("token");

  const proPassword = "QaSessionFProPassword123!";
  const activateRes = await fetch(`${baseURL}/api/pro/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: proPassword }),
  });
  if (!activateRes.ok) throw new Error("activation failed");

  const job1 = await seedOfferedJob(adminPage, proId, `qa-sf-job1-${stamp}`, 50000);
  const job2 = await seedOfferedJob(adminPage, proId, `qa-sf-job2-${stamp}`, 42000);

  // ---- Professional context ----
  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  const proLoginRes = await proPage.request.post(`${baseURL}/api/pro/auth/login`, {
    data: { email: proEmail, password: proPassword },
  });
  if (!proLoginRes.ok()) throw new Error("pro login failed");

  // 01 — login page (separate, unauthenticated context)
  const anonCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${baseURL}/pro/login`, { waitUntil: "networkidle" });
  await shot(anonPage, "01-pro-login.png");
  await anonCtx.close();

  // 02 — home, both jobs still offered
  await proPage.goto(`${baseURL}/pro`, { waitUntil: "networkidle" });
  await shot(proPage, "02-pro-home-offer.png");

  // 03 — job1 detail, OFFERED
  await proPage.goto(`${baseURL}/pro/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(proPage, "03-pro-job-offered.png");

  // 12 — admin view of job1, OFFERED
  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "12-admin-job-offered.png", 1440);

  // Clicks a button, waits for its POST response AND the resulting
  // client-side router.refresh() to actually land, then reloads for a
  // guaranteed-fresh server render before screenshotting — a fixed
  // timeout races the fetch+refresh under headless/cold-cache conditions.
  async function actionAndReload(page, buttonText, urlFragment) {
    const button = page.getByRole("button", { name: buttonText, exact: true });
    await button.waitFor({ state: "visible", timeout: 10_000 });
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(urlFragment) && r.request().method() === "POST", { timeout: 15_000 }),
      button.click(),
    ]);
    if (!response.ok()) {
      const body = await response.text().catch(() => "<unreadable>");
      throw new Error(`${urlFragment} returned ${response.status()}: ${body}`);
    }
    await page.reload({ waitUntil: "networkidle" });
  }

  // 09 — decline dialog on job2
  await proPage.goto(`${baseURL}/pro/jobs/${job2}`, { waitUntil: "networkidle" });
  await proPage.click("text=Decline");
  await shot(proPage, "09-pro-decline.png");
  await actionAndReload(proPage, "Confirm decline", "/decline");

  // Accept job1
  await proPage.goto(`${baseURL}/pro/jobs/${job1}`, { waitUntil: "networkidle" });
  await actionAndReload(proPage, "Accept job", "/accept");
  await shot(proPage, "04-pro-job-accepted.png");

  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "13-admin-job-accepted.png", 1440);

  // En route
  await actionAndReload(proPage, "En route", "/en-route");
  await shot(proPage, "05-pro-en-route.png");

  // Arrived
  await actionAndReload(proPage, "Arrived", "/arrived");
  await shot(proPage, "06-pro-arrived.png");

  // Start
  await actionAndReload(proPage, "Start job", "/start");
  await shot(proPage, "07-pro-in-progress.png");

  // 10 — report problem dialog, then submit
  await proPage.click("text=Report a problem");
  await shot(proPage, "10-pro-report-problem.png");
  await actionAndReload(proPage, "Report problem", "/problem");

  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "14-admin-problem-reported.png", 1440);

  // Complete
  await actionAndReload(proPage, "Complete job", "/complete");
  await shot(proPage, "08-pro-completion-reported.png");

  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "15-admin-completion-reported.png", 1440);

  // 11 — profile
  await proPage.goto(`${baseURL}/pro/profile`, { waitUntil: "networkidle" });
  await shot(proPage, "11-pro-profile.png");

  await browser.close();
  console.log("Session F screenshots done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
