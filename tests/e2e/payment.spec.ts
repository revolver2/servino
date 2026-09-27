import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { apiPost, apiGet, fakeIp } from "./helpers/api";
import { seedSubmittedJob, seedPaidJob } from "./helpers/payments";
import { ensureActivatedProfessional } from "./helpers/pro";

// Gives this file's admin-page requests their own rate-limit bucket
// (clientIp() reads X-Forwarded-For), separate from every other spec
// file's admin tests sharing the default "unknown" bucket — otherwise
// combined admin-mutation volume across the full serial suite run can
// exceed the real, unmodified 60/60s limit (spec section 47) purely
// from test count, not from anything wrong with the app. Same pattern
// as fakeIp()/fakeProIp() for lead/professional endpoints.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.201" } });

test.describe("Checkout — order creation and capture (spec sections 19/20)", () => {
  test("create-order then capture-order results in a CAPTURED payment, server-authoritative amount, gates the offer route", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const sessionId = `payment-happy-${stamp}`;
    const job = await seedSubmittedJob(baseURL!, sessionId);

    const ip = { "X-Forwarded-For": fakeIp(sessionId) };
    const createRes = await apiPost<{ providerOrderId: string; amountMinor: number; currency: string }>(
      baseURL!,
      "/api/lead/payment/create-order",
      { sessionId },
      ip
    );
    expect(createRes.status).toBe(200);
    const data = (createRes.json as { ok: true; data: { providerOrderId: string; amountMinor: number } }).data;
    expect(data.providerOrderId).toBeTruthy();

    // Payment.amountMinor came from the server's own QuoteSnapshot, never
    // anything this request could have supplied — it wasn't even in the body.
    const paymentAfterCreate = await testDb.payment.findUnique({ where: { jobId: job.id } });
    expect(paymentAfterCreate!.status).toBe("CREATED");
    expect(paymentAfterCreate!.amountMinor).toBe(data.amountMinor);

    // Admin has already reviewed and approved this job for assignment —
    // isolates the D044 payment gate below from the separate review
    // transition, which isn't what this assertion is about.
    await testDb.job.update({ where: { id: job.id }, data: { status: "REVIEWING" } });
    await testDb.job.update({ where: { id: job.id }, data: { status: "READY_FOR_ASSIGNMENT" } });

    // Offer is rejected before payment is captured (D044).
    const pro = await ensureActivatedProfessional({ email: `payment-happy-pro-${stamp}@example.com` });
    const earlyOffer = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });
    expect(earlyOffer.status()).toBe(400);

    const captureRes = await apiPost(
      baseURL!,
      "/api/lead/payment/capture-order",
      { sessionId, providerOrderId: data.providerOrderId },
      ip
    );
    expect(captureRes.status).toBe(200);

    const paymentAfterCapture = await testDb.payment.findUnique({ where: { jobId: job.id } });
    expect(paymentAfterCapture!.status).toBe("CAPTURED");
    expect(paymentAfterCapture!.paypalCaptureId).toBeTruthy();

    const events = await testDb.paymentEvent.findMany({ where: { paymentId: paymentAfterCapture!.id } });
    expect(events.some((e) => e.eventType === "orders.capture.completed")).toBe(true);

    const auditCaptured = await testDb.auditEvent.findFirst({
      where: { entityType: "PAYMENT", entityId: paymentAfterCapture!.id, action: "PAYMENT_CAPTURED" },
    });
    expect(auditCaptured).not.toBeNull();

    // Lead advances to CONFIRMATION only after real capture.
    const lead = await testDb.lead.findUnique({ where: { id: job.leadId } });
    expect(lead!.currentStep).toBe("CONFIRMATION");

    // Now the offer route accepts it.
    const laterOffer = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });
    expect(laterOffer.status()).toBe(201);

    // Confirmation shows a distinct "payment confirmed" fact.
    const confirmation = await apiGet<{ status: string; paymentStatus: string }>(
      baseURL!,
      `/api/lead/confirmation?sessionId=${encodeURIComponent(sessionId)}`
    );
    expect((confirmation.json as { ok: true; data: { paymentStatus: string } }).data.paymentStatus).toBe("CAPTURED");
  });

  test("create-order is idempotent — a double tap reuses the same order, never creates two Payment rows or two orders", async ({
    baseURL,
  }) => {
    const stamp = Date.now();
    const sessionId = `payment-double-create-${stamp}`;
    await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const [first, second] = await Promise.all([
      apiPost<{ providerOrderId: string }>(baseURL!, "/api/lead/payment/create-order", { sessionId }, ip),
      apiPost<{ providerOrderId: string }>(baseURL!, "/api/lead/payment/create-order", { sessionId }, ip),
    ]);
    const firstId = (first.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;
    const secondId = (second.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;
    expect(firstId).toBe(secondId);

    const lead = await testDb.lead.findUnique({ where: { sessionId } });
    const payments = await testDb.payment.findMany({ where: { job: { leadId: lead!.id } } });
    expect(payments).toHaveLength(1);
  });

  test("capture-order is idempotent — repeated confirm requests never double-capture or duplicate PaymentEvent rows", async ({
    baseURL,
  }) => {
    const stamp = Date.now();
    const sessionId = `payment-double-capture-${stamp}`;
    const { job, providerOrderId } = await seedPaidJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const repeat = await apiPost(baseURL!, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip);
    expect(repeat.status).toBe(200);

    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });
    expect(payment!.status).toBe("CAPTURED");

    const completedEvents = await testDb.paymentEvent.count({
      where: { paymentId: payment!.id, eventType: "orders.capture.completed" },
    });
    expect(completedEvents).toBe(1);
  });

  test("a declined test-provider capture never marks the payment CAPTURED", async ({ baseURL }) => {
    const stamp = Date.now();
    const sessionId = `payment-declined-${stamp}`;
    const job = await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const createRes = await apiPost<{ providerOrderId: string }>(
      baseURL!,
      "/api/lead/payment/create-order",
      { sessionId, testScenario: "DECLINE" },
      ip
    );
    const providerOrderId = (createRes.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;

    const captureRes = await apiPost(baseURL!, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip);
    expect(captureRes.status).toBe(402);

    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });
    expect(payment!.status).toBe("FAILED");
  });

  test("a provider outage at order-creation time leaves the payment FAILED, never fabricates success", async ({
    baseURL,
  }) => {
    const stamp = Date.now();
    const sessionId = `payment-outage-${stamp}`;
    const job = await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const createRes = await apiPost(baseURL!, "/api/lead/payment/create-order", { sessionId, testScenario: "OUTAGE" }, ip);
    expect(createRes.status).toBe(502);

    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });
    expect(payment!.status).toBe("FAILED");
  });

  test("money tampering: a forged/foreign provider order id is rejected, never captured", async ({ baseURL }) => {
    const stamp = Date.now();
    const sessionId = `payment-forged-order-${stamp}`;
    await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    await apiPost(baseURL!, "/api/lead/payment/create-order", { sessionId }, ip);

    const forgedRes = await apiPost(
      baseURL!,
      "/api/lead/payment/capture-order",
      { sessionId, providerOrderId: "TEST-ORDER-forged-by-attacker" },
      ip
    );
    expect(forgedRes.status).toBe(400);

    const lead = await testDb.lead.findUnique({ where: { sessionId } });
    const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
    const payment = await testDb.payment.findUnique({ where: { jobId: job!.id } });
    expect(payment!.status).not.toBe("CAPTURED");
  });

  test("payment IDOR: customer A's session cannot create or capture a payment for customer B's job", async ({
    baseURL,
  }) => {
    const stamp = Date.now();
    const sessionA = `payment-idor-a-${stamp}`;
    const sessionB = `payment-idor-b-${stamp}`;
    await seedSubmittedJob(baseURL!, sessionA);
    await seedSubmittedJob(baseURL!, sessionB);

    const ipA = { "X-Forwarded-For": fakeIp(sessionA) };

    // A's session can only ever act on A's own job — there is no job ID
    // in the request at all (D040), only A's own sessionId, so there is
    // no parameter to substitute B's job into in the first place. Confirm
    // A's create-order produced A's own Payment, not B's.
    const createA = await apiPost<{ providerOrderId: string }>(
      baseURL!,
      "/api/lead/payment/create-order",
      { sessionId: sessionA },
      ipA
    );
    const orderIdA = (createA.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;

    const leadA = await testDb.lead.findUnique({ where: { sessionId: sessionA } });
    const jobA = await testDb.job.findUnique({ where: { leadId: leadA!.id } });
    const paymentA = await testDb.payment.findUnique({ where: { jobId: jobA!.id } });
    expect(paymentA!.paypalOrderId).toBe(orderIdA);

    const leadB = await testDb.lead.findUnique({ where: { sessionId: sessionB } });
    const jobB = await testDb.job.findUnique({ where: { leadId: leadB!.id } });
    const paymentB = await testDb.payment.findUnique({ where: { jobId: jobB!.id } });
    expect(paymentB).toBeNull(); // untouched by A's requests

    // And B's own capture attempt using A's order id is rejected — proves
    // the server checks the order belongs to the SESSION's own payment,
    // not just that some payment somewhere has that order id.
    const ipB = { "X-Forwarded-For": fakeIp(sessionB) };
    await apiPost(baseURL!, "/api/lead/payment/create-order", { sessionId: sessionB }, ipB);
    const crossCapture = await apiPost(
      baseURL!,
      "/api/lead/payment/capture-order",
      { sessionId: sessionB, providerOrderId: orderIdA },
      ipB
    );
    expect(crossCapture.status).toBe(400);
  });
});
