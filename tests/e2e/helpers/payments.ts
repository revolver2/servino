import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { testDb } from "./db";
import { apiPost, fakeIp } from "./api";
import { ensureActivatedProfessional, proLogin, fakeProIp } from "./pro";
import { fakeAdminIp } from "./admin";

/**
 * Mirrors src/lib/payments/test-payment-provider.ts's TEST_WEBHOOK_SECRET
 * and signing scheme — same cross-boundary-import-avoidance precedent as
 * helpers/admin.ts and helpers/pro.ts duplicating password hashing.
 */
const TEST_WEBHOOK_SECRET = "servino-test-webhook-secret-not-a-real-credential";

export function signTestWebhookPayload(rawBody: string): string {
  return createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export function makeWebhookEvent(opts: {
  id: string;
  eventType: string;
  captureId?: string;
  orderId?: string;
  amountMinor?: number;
  status?: string;
}) {
  return {
    id: opts.id,
    event_type: opts.eventType,
    resource: {
      id: opts.captureId,
      status: opts.status ?? "COMPLETED",
      amount: opts.amountMinor != null ? { value: (opts.amountMinor / 100).toFixed(2), currency_code: "CAD" } : undefined,
      supplementary_data: opts.orderId ? { related_ids: { order_id: opts.orderId } } : undefined,
    },
  };
}

/** Carries a real customer funnel through to a submitted BookingIntent + Job (status NEW), without paying. */
export async function seedSubmittedJob(baseURL: string, sessionId: string, serviceSlug = "wall-panels") {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug,
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 10,
      // No styleId — serviceSlug is a caller-overridable parameter and
      // styles are service-specific (Session H0.2); this helper doesn't
      // test style.
      materialOwnership: "MATERIAL_AND_INSTALL",
      currentStep: "PRICE",
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/price", { sessionId }, ip);
  await apiPost(
    baseURL,
    "/api/lead/contact",
    {
      sessionId,
      firstName: "PaySpec",
      email: `${sessionId}@example.com`,
      phone: "4165550031",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  await apiPost(baseURL, "/api/lead/booking-intent", { sessionId }, ip);

  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
  return job!;
}

/** Same, but also completes checkout (TestPaymentProvider SUCCESS) — Payment ends CAPTURED. */
export async function seedPaidJob(baseURL: string, sessionId: string, serviceSlug = "wall-panels") {
  await seedSubmittedJob(baseURL, sessionId, serviceSlug);
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };

  const createRes = await apiPost<{ providerOrderId: string }>(
    baseURL,
    "/api/lead/payment/create-order",
    { sessionId },
    ip
  );
  const providerOrderId = (createRes.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;

  const captureRes = await apiPost(baseURL, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip);

  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id }, include: { payment: true } });
  return { job: job!, providerOrderId, captureRes };
}

/**
 * Full realistic path from a paid, submitted job to Job.status =
 * COMPLETED (professional-reported): admin review -> offer -> pro
 * accept -> en route -> arrived -> start -> complete. Mirrors
 * pro-workflow.spec.ts's own seedReadyJob + field-progression pattern.
 * Caller is responsible for closing the returned `proContext`.
 */
export async function advanceToCompleted(
  baseURL: string,
  adminPage: Page,
  job: { id: string },
  proEmail: string,
  offerAmountMinor = 30000
) {
  await testDb.job.update({ where: { id: job.id }, data: { status: "REVIEWING" } });
  await testDb.job.update({ where: { id: job.id }, data: { status: "READY_FOR_ASSIGNMENT" } });

  const pro = await ensureActivatedProfessional({ email: proEmail });
  const offerRes = await adminPage.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
    data: { professionalId: pro.id, offerAmountMinor },
    headers: { "X-Forwarded-For": fakeAdminIp(job.id) },
  });
  if (offerRes.status() !== 201) throw new Error(`Offer failed with status ${offerRes.status()}`);

  const proContext = await adminPage
    .context()
    .browser()!
    .newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(proEmail) } });
  const proPage = await proContext.newPage();
  await proLogin(proPage.request, baseURL, pro.email);

  await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
  await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/en-route`);
  await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/arrived`);
  await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/start`);
  const completeRes = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/complete`);
  if (completeRes.status() !== 200) throw new Error(`Complete failed with status ${completeRes.status()}`);

  const acceptedOffer = await testDb.jobOffer.findFirst({ where: { jobId: job.id, professionalId: pro.id, status: "ACCEPTED" } });

  return { pro, proContext, proPage, offerAmountMinor, jobOfferId: acceptedOffer!.id };
}

/** Generates a real completion-confirmation token via the admin route — returns the raw token. */
export async function generateCompletionToken(baseURL: string, adminPage: Page, jobId: string) {
  const res = await adminPage.request.post(`${baseURL}/api/admin/jobs/${jobId}/completion-token`, {
    headers: { "X-Forwarded-For": fakeAdminIp(jobId) },
  });
  if (res.status() !== 200) throw new Error(`Completion token generation failed with status ${res.status()}`);
  const body = (await res.json()) as { data: { confirmPath: string } };
  const token = new URL(`${baseURL}${body.data.confirmPath}`).searchParams.get("token");
  return token!;
}
