// Session H fresh-database full lifecycle verification (spec section
// 91). Drives the ENTIRE first-real-job path against a genuinely empty,
// freshly-migrated database (servino_fresh_h) via real API calls: admin
// login -> pricing setup -> professional creation/activation -> customer
// funnel -> TestPaymentProvider payment -> offer -> accept -> field
// workflow -> completion -> customer confirmation -> payout eligible ->
// manual payout recorded -> actual economics entered -> /admin/launch
// shows 1/10.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "owner@servino.local";
const ADMIN_PASSWORD = "Servino-Fresh-H-2026-Pass";

async function post(page, path, data) {
  const res = await page.request.post(`${BASE}${path}`, { data });
  const json = await res.json().catch(() => null);
  if (!res.ok()) throw new Error(`POST ${path} failed: ${res.status()} ${JSON.stringify(json)}`);
  return json;
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  console.log("[1] Admin login...");
  const login = await page.request.post(`${BASE}/api/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!login.ok()) throw new Error(`Admin login failed: ${login.status()}`);
  console.log("    OK");

  console.log("[2] Create + activate a Toronto PricingVersion...");
  const version = await post(page, "/api/admin/pricing/versions", {
    citySlug: "toronto",
    label: "Fresh-DB Drill v1",
    taxRatePercent: 13,
    taxLabel: "HST (13%)",
    professionalPayoutPercentOfLabor: 75,
    materialCostPercentOfCustomerRate: 40,
    paymentProcessingPercent: 2.9,
    paymentProcessingFixedMinor: 30,
    estimatedCacMinor: 7500,
    otherVariableCostMinor: 1000,
    healthyMarginPercent: 30,
    acceptableMarginPercent: 15,
    lowMarginPercent: 5,
    notes: "Fresh-DB lifecycle drill — not a real launch version.",
    rules: [
      { serviceSlug: "wall-panels", installOnlyRateMinorPerM2: 8000, materialRateMinorPerM2: 5000, minimumSubtotalMinor: 30000 },
      { serviceSlug: "marble-sheets", installOnlyRateMinorPerM2: 9000, materialRateMinorPerM2: 12000, minimumSubtotalMinor: 40000 },
      { serviceSlug: "wallpaper", installOnlyRateMinorPerM2: 4000, materialRateMinorPerM2: 2000, minimumSubtotalMinor: 20000 },
      { serviceSlug: "decorative-partitions", installOnlyRateMinorPerM2: 10000, materialRateMinorPerM2: 6000, minimumSubtotalMinor: 50000 },
    ],
  });
  await post(page, `/api/admin/pricing/versions/${version.data.id}/activate`, {});
  console.log(`    OK — version ${version.data.id} active`);

  console.log("[3] Create + activate a professional...");
  const proEmail = `fresh-drill-pro-${Date.now()}@example.com`;
  const pro = await post(page, "/api/admin/professionals", {
    displayName: "Fresh Drill Pro",
    email: proEmail,
    phone: "4165550111",
    serviceSlugs: ["wall-panels"],
    verificationStatus: "VERIFIED",
  });
  const activation = await post(page, `/api/admin/professionals/${pro.data.id}/activation`, {});
  const token = new URL(`${BASE}${activation.data.activationPath}`).searchParams.get("token");
  const proPassword = "FreshDrillProPass123!";
  const activateRes = await fetch(`${BASE}/api/pro/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: proPassword }),
  });
  if (!activateRes.ok) throw new Error("Professional activation failed");
  console.log(`    OK — professional ${pro.data.id} activated`);

  console.log("[4] Customer funnel through payment...");
  const sessionId = `fresh-drill-${Date.now()}`;
  const ip = { "X-Forwarded-For": "198.51.100.201" };
  const j = (body) => JSON.stringify(body);
  await fetch(`${BASE}/api/lead/progress`, {
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
  await fetch(`${BASE}/api/lead/price`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId }) });
  await fetch(`${BASE}/api/lead/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: j({ sessionId, firstName: "FreshDrill", email: `${sessionId}@example.com`, phone: "4165550112", formRenderedAt: new Date(Date.now() - 5000).toISOString() }),
  });
  await fetch(`${BASE}/api/lead/timing`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId, value: "ASAP" }) });
  await fetch(`${BASE}/api/lead/booking-intent`, { method: "POST", headers: { "Content-Type": "application/json", ...ip }, body: j({ sessionId }) });

  const createOrder = await fetch(`${BASE}/api/lead/payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: j({ sessionId }),
  }).then((r) => r.json());
  const captureRes = await fetch(`${BASE}/api/lead/payment/capture-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ip },
    body: j({ sessionId, providerOrderId: createOrder.data.providerOrderId }),
  }).then((r) => r.json());
  if (!captureRes.data?.captured) throw new Error("Payment capture did not succeed");
  console.log("    OK — payment CAPTURED (TestPaymentProvider)");

  const jobsPage = await page.request.get(`${BASE}/admin/jobs?q=${encodeURIComponent(sessionId)}`);
  const html = await jobsPage.text();
  const jobIdMatch = html.match(/\/admin\/jobs\/([a-z0-9]+)/);
  if (!jobIdMatch) throw new Error("Could not resolve job id");
  const jobId = jobIdMatch[1];
  console.log(`    Job: ${jobId}`);

  console.log("[5] Admin review -> offer...");
  await post(page, `/api/admin/jobs/${jobId}/status`, { status: "REVIEWING" });
  await post(page, `/api/admin/jobs/${jobId}/status`, { status: "READY_FOR_ASSIGNMENT" });
  const offerAmountMinor = 48000;
  await post(page, `/api/admin/jobs/${jobId}/offer`, { professionalId: pro.data.id, offerAmountMinor });
  console.log("    OK — offered");

  console.log("[6] Professional accepts + full field workflow...");
  const proCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const proPage = await proCtx.newPage();
  const proLogin = await proPage.request.post(`${BASE}/api/pro/auth/login`, { data: { email: proEmail, password: proPassword } });
  if (!proLogin.ok()) throw new Error("Pro login failed");
  for (const step of ["accept", "en-route", "arrived", "start", "complete"]) {
    const res = await proPage.request.post(`${BASE}/api/pro/jobs/${jobId}/${step}`);
    if (!res.ok()) throw new Error(`Pro step ${step} failed: ${res.status()}`);
  }
  console.log("    OK — accepted through completion reported");

  console.log("[7] Customer completion confirmation...");
  const tokenRes = await post(page, `/api/admin/jobs/${jobId}/completion-token`, {});
  const confirmToken = new URL(`${BASE}${tokenRes.data.confirmPath}`).searchParams.get("token");
  const confirmRes = await fetch(`${BASE}/api/customer/confirm-completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: confirmToken }),
  });
  if (!confirmRes.ok) throw new Error("Customer confirmation failed");
  console.log("    OK — Job CONFIRMED, payout eligibility computed");

  console.log("[8] Record payout as paid...");
  const payoutsPage = await page.request.get(`${BASE}/admin/payouts`);
  const payoutsHtml = await payoutsPage.text();
  const payoutIdMatch = payoutsHtml.match(/\/admin\/payouts\/([a-z0-9]+)/);
  if (!payoutIdMatch) throw new Error("Could not resolve payout id");
  const payoutId = payoutIdMatch[1];
  await post(page, `/api/admin/payouts/${payoutId}/record`, {
    amountMinor: offerAmountMinor,
    methodCategory: "E_TRANSFER",
    externalReference: "fresh-drill-etf-001",
  });
  console.log(`    OK — payout ${payoutId} recorded PAID`);

  console.log("[9] Enter actual costs...");
  await post(page, `/api/admin/jobs/${jobId}/actuals`, {
    actualMaterialCostMinor: 48000,
    actualCacMinor: 6500,
    actualOtherVariableCostMinor: 0,
    note: "Fresh-DB drill actuals",
  });
  console.log("    OK");

  console.log("[10] Verify /admin/launch shows 1/10...");
  await page.goto(`${BASE}/admin/launch`, { waitUntil: "networkidle" });
  const bodyText = await page.textContent("body");
  const milestoneOk = /1\s*\/\s*10/.test(bodyText);
  console.log(`    Milestone shows 1/10: ${milestoneOk}`);
  await page.screenshot({ path: "docs/qa/session-h/fresh-db-launch-1-of-10.png", fullPage: true });

  await browser.close();

  if (!milestoneOk) {
    console.error("\nFAIL — launch dashboard did not show 1/10 completed paid jobs.");
    process.exit(1);
  }
  console.log("\nPASS — full fresh-database lifecycle verified end to end, 1/10 completed paid jobs confirmed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
