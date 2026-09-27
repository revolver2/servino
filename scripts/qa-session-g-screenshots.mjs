// Session G QA screenshot + fresh-DB verification driver. Requires the
// target server already running against servino_dev with an admin
// account already bootstrapped (see docs/ADMIN_OPERATIONS.md), same
// convention as scripts/qa-session-f-screenshots.mjs. Also serves as the
// manual paid-job E2E and issue E2E walkthrough for the completion
// report — every step here is a real API/UI action, not a simulation.
// Usage: node scripts/qa-session-g-screenshots.mjs <output-dir> <base-url> <adminEmail> <adminPassword>
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

async function customerFunnelThroughBookingIntent(sessionId, seed) {
  const ip = { "X-Forwarded-For": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
  const j = (body) => JSON.stringify(body);
  await fetch(`${baseURL}/api/lead/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: j({
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
  await fetch(`${baseURL}/api/lead/price`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId }) });
  await fetch(`${baseURL}/api/lead/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: j({ sessionId, firstName: seed, email: `${sessionId}@example.com`, phone: "4165550199", formRenderedAt: new Date(Date.now() - 5000).toISOString() }),
  });
  await fetch(`${baseURL}/api/lead/timing`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId, value: "ASAP" }) });
  await fetch(`${baseURL}/api/lead/booking-intent`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId }) });
}

async function resolveJobId(adminPage, sessionId) {
  const jobsPage = await adminPage.request.get(`${baseURL}/admin/jobs?q=${encodeURIComponent(sessionId)}`);
  const html = await jobsPage.text();
  const match = html.match(/\/admin\/jobs\/([a-z0-9]+)/);
  if (!match) throw new Error(`Could not resolve job id for session ${sessionId}`);
  return match[1];
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const loginRes = await adminPage.request.post(`${baseURL}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPassword } });
  if (!loginRes.ok()) throw new Error(`admin login failed: ${loginRes.status()}`);

  const stamp = Date.now();
  const proEmail = `qa-session-g-pro-${stamp}@example.com`;
  const createPro = await post(adminPage, "/api/admin/professionals", {
    displayName: "QA Session G Pro",
    email: proEmail,
    phone: "4165550101",
    serviceSlugs: ["wall-panels"],
    verificationStatus: "VERIFIED",
  });
  const proId = createPro.data.id;
  const activation = await post(adminPage, `/api/admin/professionals/${proId}/activation`, {});
  const proToken = new URL(`${baseURL}${activation.data.activationPath}`).searchParams.get("token");
  const proPassword = "QaSessionGProPassword123!";
  await fetch(`${baseURL}/api/pro/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: proToken, password: proPassword }),
  });

  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  const proLoginRes = await proPage.request.post(`${baseURL}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  if (!proLoginRes.ok()) throw new Error("pro login failed");

  // ==========================================================================
  // JOB 1 — full paid happy path through to payout paid
  // ==========================================================================
  const session1 = `qa-sg-paid-${stamp}`;
  await customerFunnelThroughBookingIntent(session1, "SessionG Customer");

  // Customer checkout page — mobile 390.
  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const custPage = await custCtx.newPage();
  // Seed the browser's own localStorage session id so the client funnel
  // recognizes this exact server-side lead — mirrors how the real funnel
  // persists it (src/lib/quote/session.ts).
  await custPage.goto(`${baseURL}/quote/project`, { waitUntil: "networkidle" });
  await custPage.evaluate((sid) => {
    localStorage.setItem("servino_session_id", JSON.stringify(sid));
  }, session1);
  await custPage.goto(`${baseURL}/quote/payment`, { waitUntil: "networkidle" });
  await custPage.waitForSelector("text=Confirm and pay");
  await shot(custPage, "customer-checkout.png");

  await custPage.getByRole("button", { name: /Pay .* with PayPal/ }).click();
  await custPage.waitForURL("**/quote/confirmation", { timeout: 10_000 });
  await custPage.waitForSelector("text=Payment confirmed");
  await shot(custPage, "customer-payment-confirmed.png");
  await custCtx.close();

  const job1 = await resolveJobId(adminPage, session1);
  await post(adminPage, `/api/admin/jobs/${job1}/status`, { status: "REVIEWING" });
  await post(adminPage, `/api/admin/jobs/${job1}/status`, { status: "READY_FOR_ASSIGNMENT" });
  await post(adminPage, `/api/admin/jobs/${job1}/offer`, { professionalId: proId, offerAmountMinor: 48000 });

  // Admin payments list + detail — desktop 1440.
  await adminPage.goto(`${baseURL}/admin/payments`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-payments-list.png", 1440);
  const paymentRow = await adminPage.request.get(`${baseURL}/admin/payments`);
  const paymentsHtml = await paymentRow.text();
  const paymentMatch = paymentsHtml.match(/\/admin\/payments\/([a-z0-9]+)/);
  const paymentId = paymentMatch[1];
  await adminPage.goto(`${baseURL}/admin/payments/${paymentId}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-payment-detail.png", 1440);

  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-job-paid.png", 1440);

  // Professional: accept -> field workflow -> complete (real UI clicks).
  async function actionAndReload(page, buttonText, urlFragment) {
    const button = page.getByRole("button", { name: buttonText, exact: true });
    await button.waitFor({ state: "visible", timeout: 10_000 });
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(urlFragment) && r.request().method() === "POST", { timeout: 15_000 }),
      button.click(),
    ]);
    if (!response.ok()) throw new Error(`${urlFragment} returned ${response.status()}`);
    await page.reload({ waitUntil: "networkidle" });
  }

  await proPage.goto(`${baseURL}/pro/jobs/${job1}`, { waitUntil: "networkidle" });
  await actionAndReload(proPage, "Accept job", "/accept");
  await actionAndReload(proPage, "En route", "/en-route");
  await actionAndReload(proPage, "Arrived", "/arrived");
  await actionAndReload(proPage, "Start job", "/start");
  await actionAndReload(proPage, "Complete job", "/complete");

  // Professional payout status — Not yet eligible (job just completed).
  await proPage.reload({ waitUntil: "networkidle" });
  await shot(proPage, "pro-payout-not-eligible.png");

  await adminPage.goto(`${baseURL}/admin/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-completion-awaiting.png", 1440);

  const tokenRes = await post(adminPage, `/api/admin/jobs/${job1}/completion-token`, {});
  const confirmToken = new URL(`${baseURL}${tokenRes.data.confirmPath}`).searchParams.get("token");

  const confirmCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const confirmPage = await confirmCtx.newPage();
  await confirmPage.goto(`${baseURL}/confirm?token=${confirmToken}`, { waitUntil: "networkidle" });
  await confirmPage.waitForSelector("text=How did your project go?");
  await shot(confirmPage, "customer-completion-confirmation.png");
  await confirmPage.getByRole("button", { name: "Work completed" }).click();
  await confirmPage.waitForSelector("text=Thanks for confirming.");
  await confirmCtx.close();

  await adminPage.goto(`${baseURL}/admin/payouts`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-payouts-eligible.png", 1440);
  const payoutsHtml = await (await adminPage.request.get(`${baseURL}/admin/payouts`)).text();
  const payoutMatch = payoutsHtml.match(/\/admin\/payouts\/([a-z0-9]+)/);
  const payoutId = payoutMatch[1];
  await adminPage.goto(`${baseURL}/admin/payouts/${payoutId}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-payout-eligible-detail.png", 1440);

  await proPage.goto(`${baseURL}/pro/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(proPage, "pro-payout-eligible.png");

  await post(adminPage, `/api/admin/payouts/${payoutId}/record`, { amountMinor: 48000, methodCategory: "E_TRANSFER", externalReference: "qa-etf-001" });
  await adminPage.goto(`${baseURL}/admin/payouts/${payoutId}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-payout-paid-detail.png", 1440);

  await proPage.goto(`${baseURL}/pro/jobs/${job1}`, { waitUntil: "networkidle" });
  await shot(proPage, "pro-payout-paid.png");

  // ==========================================================================
  // JOB 2 — issue path (customer reports an issue instead of confirming)
  // ==========================================================================
  const session2 = `qa-sg-issue-${stamp}`;
  await customerFunnelThroughBookingIntent(session2, "SessionG IssueCustomer");
  const job2 = await resolveJobId(adminPage, session2);

  // Pay via API directly (already covered via real UI for job1).
  const ip2 = { "X-Forwarded-For": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
  const createOrderRes = await fetch(`${baseURL}/api/lead/payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip2 },
    body: JSON.stringify({ sessionId: session2 }),
  }).then((r) => r.json());
  await fetch(`${baseURL}/api/lead/payment/capture-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip2 },
    body: JSON.stringify({ sessionId: session2, providerOrderId: createOrderRes.data.providerOrderId }),
  });

  await post(adminPage, `/api/admin/jobs/${job2}/status`, { status: "REVIEWING" });
  await post(adminPage, `/api/admin/jobs/${job2}/status`, { status: "READY_FOR_ASSIGNMENT" });
  await post(adminPage, `/api/admin/jobs/${job2}/offer`, { professionalId: proId, offerAmountMinor: 39000 });

  await proPage.goto(`${baseURL}/pro/jobs/${job2}`, { waitUntil: "networkidle" });
  await actionAndReload(proPage, "Accept job", "/accept");
  await actionAndReload(proPage, "En route", "/en-route");
  await actionAndReload(proPage, "Arrived", "/arrived");
  await actionAndReload(proPage, "Start job", "/start");
  await actionAndReload(proPage, "Complete job", "/complete");

  const tokenRes2 = await post(adminPage, `/api/admin/jobs/${job2}/completion-token`, {});
  const confirmToken2 = new URL(`${baseURL}${tokenRes2.data.confirmPath}`).searchParams.get("token");

  const issueCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const issuePage = await issueCtx.newPage();
  await issuePage.goto(`${baseURL}/confirm?token=${confirmToken2}`, { waitUntil: "networkidle" });
  await issuePage.getByRole("button", { name: "Report an issue" }).click();
  await issuePage.selectOption("#reasonCode", "QUALITY");
  await issuePage.fill("#note", "Edges weren't finished cleanly — QA screenshot walkthrough.");
  await shot(issuePage, "customer-issue-report.png");
  await issuePage.getByRole("button", { name: "Submit report" }).click();
  await issuePage.waitForSelector("text=We've received your report.");
  await issueCtx.close();

  await adminPage.goto(`${baseURL}/admin/jobs/${job2}`, { waitUntil: "networkidle" });
  await shot(adminPage, "admin-issue-hold.png", 1440);

  // Refund UI state on job1's payment (already fully paid out — shows the
  // "professional already paid" warning banner along with the refund form).
  await adminPage.goto(`${baseURL}/admin/payments/${paymentId}`, { waitUntil: "networkidle" });
  await adminPage.getByRole("button", { name: "Issue full refund" }).click();
  await adminPage.fill("#refund-reason", "QA screenshot walkthrough — demonstrating the refund confirmation UI.");
  await shot(adminPage, "admin-refund-confirm.png", 1440);

  await browser.close();
  console.log("Session G screenshots done.");
  console.log(JSON.stringify({ job1, job2, paymentId, payoutId, session1, session2 }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
