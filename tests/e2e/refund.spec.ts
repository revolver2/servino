import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { seedPaidJob, advanceToCompleted, generateCompletionToken } from "./helpers/payments";

// Own rate-limit bucket for this file's admin-page requests — see
// payment.spec.ts's identical comment for why.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.203" } });

test.describe("Refund foundation (spec sections 50/51)", () => {
  test("admin issues a full refund — Payment becomes REFUNDED, provider refund id persisted, audited", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-happy-${stamp}`);
    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });

    const res = await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      data: { reason: "Customer cancelled before work began." },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.providerRefundId).toBeTruthy();

    const updated = await testDb.payment.findUnique({ where: { id: payment!.id } });
    expect(updated!.status).toBe("REFUNDED");

    const refund = await testDb.refund.findFirst({ where: { paymentId: payment!.id } });
    expect(refund!.status).toBe("COMPLETED");
    expect(refund!.amountMinor).toBe(payment!.amountMinor); // full refund, server-derived
    expect(refund!.paypalRefundId).toBeTruthy();

    const auditInitiated = await testDb.auditEvent.findFirst({
      where: { entityType: "PAYMENT", entityId: payment!.id, action: "REFUND_INITIATED" },
    });
    const auditCompleted = await testDb.auditEvent.findFirst({
      where: { entityType: "PAYMENT", entityId: payment!.id, action: "REFUND_COMPLETED" },
    });
    expect(auditInitiated).not.toBeNull();
    expect(auditCompleted).not.toBeNull();
  });

  test("a second refund attempt on an already-refunded payment is idempotent, not a double refund", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-double-${stamp}`);
    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });

    const first = await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      data: { reason: "First refund." },
    });
    expect(first.status()).toBe(200);

    const second = await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      data: { reason: "Second attempt — should be a no-op." },
    });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data.alreadyRefunded).toBe(true);

    const refundCount = await testDb.refund.count({ where: { paymentId: payment!.id, status: "COMPLETED" } });
    expect(refundCount).toBe(1); // never two completed refunds for the same payment
  });

  test("a refund without a reason is rejected", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-no-reason-${stamp}`);
    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });

    const res = await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, { data: { reason: "" } });
    expect(res.status()).toBe(400);

    const unchanged = await testDb.payment.findUnique({ where: { id: payment!.id } });
    expect(unchanged!.status).toBe("CAPTURED");
  });

  test("an unauthenticated request cannot issue a refund", async ({ baseURL }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-unauth-${stamp}`);
    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });

    const res = await fetch(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "trying without a session" }),
    });
    expect(res.status).toBe(401);

    const unchanged = await testDb.payment.findUnique({ where: { id: payment!.id } });
    expect(unchanged!.status).toBe("CAPTURED");
  });

  test("a payment that was never captured cannot be refunded", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { seedSubmittedJob } = await import("./helpers/payments");
    const job = await seedSubmittedJob(baseURL!, `refund-never-captured-${stamp}`);
    // No Payment row exists at all yet for this job — NOT_FOUND is correct.
    const fakePaymentId = "not-a-real-payment-id";
    void job;
    const res = await page.request.post(`${baseURL}/api/admin/payments/${fakePaymentId}/refund`, {
      data: { reason: "attempting to refund something never captured" },
    });
    expect(res.status()).toBe(404);
  });

  test("refunding a job whose professional was already paid flags payoutAlreadyPaid, does not silently reverse the payout", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-after-payout-${stamp}`);
    const { proContext, offerAmountMinor } = await advanceToCompleted(
      baseURL!,
      page,
      job,
      `refund-after-payout-pro-${stamp}@example.com`
    );
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);
    await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    await page.request.post(`${baseURL}/api/admin/payouts/${payout!.id}/record`, {
      data: { amountMinor: offerAmountMinor, methodCategory: "E_TRANSFER" },
    });

    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });
    const refundRes = await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      data: { reason: "Customer disputed after professional was already paid." },
    });
    expect(refundRes.status()).toBe(200);
    const refundBody = await refundRes.json();
    expect(refundBody.data.payoutAlreadyPaid).toBe(true);

    // The payout itself is NOT silently reversed — still shows PAID, the
    // true historical fact, not pretend-undone.
    const payoutAfter = await testDb.payout.findUnique({ where: { id: payout!.id } });
    expect(payoutAfter!.status).toBe("PAID");
  });

  test("refunding a job whose payout is still ELIGIBLE (not yet paid) holds the payout", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `refund-holds-eligible-${stamp}`);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `refund-holds-eligible-pro-${stamp}@example.com`);
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);
    await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    expect(payout!.status).toBe("ELIGIBLE");

    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });
    await page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, {
      data: { reason: "Customer disputed before any payout was recorded." },
    });

    const payoutAfter = await testDb.payout.findUnique({ where: { id: payout!.id } });
    expect(payoutAfter!.status).toBe("HELD");
    expect(payoutAfter!.heldReason).toContain("refund");
  });
});
