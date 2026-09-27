import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { seedPaidJob, advanceToCompleted, generateCompletionToken } from "./helpers/payments";

// Own rate-limit bucket for this file's admin-page requests — see
// payment.spec.ts's identical comment for why.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.202" } });

test.describe("Customer completion confirmation (spec sections 34/44)", () => {
  test("customer confirms via token: Job becomes CONFIRMED, Payout materializes ELIGIBLE at the accepted offer amount", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const sessionId = `confirm-happy-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext, jobOfferId, offerAmountMinor } = await advanceToCompleted(
      baseURL!,
      page,
      job,
      `confirm-happy-pro-${stamp}@example.com`,
      42500
    );
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);

    const contextRes = await fetch(`${baseURL}/api/customer/context?token=${encodeURIComponent(token)}`);
    expect(contextRes.status).toBe(200);

    const confirmRes = await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(confirmRes.status).toBe(200);

    const confirmedJob = await testDb.job.findUnique({ where: { id: job.id } });
    expect(confirmedJob!.status).toBe("CONFIRMED");

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    expect(payout).not.toBeNull();
    expect(payout!.status).toBe("ELIGIBLE");
    expect(payout!.amountMinor).toBe(offerAmountMinor); // the ACCEPTED OFFER, not any pricing estimate (D042)
    expect(payout!.jobOfferId).toBe(jobOfferId);

    const auditConfirmed = await testDb.auditEvent.findFirst({
      where: { entityType: "JOB", entityId: job.id, action: "CUSTOMER_COMPLETION_CONFIRMED" },
    });
    expect(auditConfirmed).not.toBeNull();
    expect(auditConfirmed!.actorId).toBeNull();
    expect(auditConfirmed!.actorProfessionalId).toBeNull();

    const auditEligible = await testDb.auditEvent.findFirst({
      where: { entityType: "PAYOUT", entityId: payout!.id, action: "PAYOUT_ELIGIBLE" },
    });
    expect(auditEligible).not.toBeNull();
  });

  test("a completion-confirmation token is single-use — a second attempt is rejected", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const sessionId = `confirm-single-use-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `confirm-single-use-pro-${stamp}@example.com`);
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);
    const first = await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(second.status).toBe(409);
  });

  test("customer reports an issue instead: Job stays COMPLETED (not CONFIRMED), no payout materializes", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const sessionId = `confirm-issue-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `confirm-issue-pro-${stamp}@example.com`);
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);
    const res = await fetch(`${baseURL}/api/customer/report-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, reasonCode: "QUALITY", note: "Edges weren't finished cleanly." }),
    });
    expect(res.status).toBe(200);

    const jobAfter = await testDb.job.findUnique({ where: { id: job.id } });
    expect(jobAfter!.status).toBe("COMPLETED"); // NOT auto-transitioned to CONFIRMED

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    expect(payout).toBeNull(); // never materialized while an issue is open

    const issue = await testDb.customerIssueReport.findFirst({ where: { jobId: job.id } });
    expect(issue).not.toBeNull();
    expect(issue!.resolved).toBe(false);

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "JOB", entityId: job.id, action: "CUSTOMER_ISSUE_REPORTED" },
    });
    expect(audit).not.toBeNull();
  });

  test("admin completion override requires a reason, is labeled ADMIN_COMPLETION_CONFIRMED, and also makes payout eligible", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const sessionId = `admin-override-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `admin-override-pro-${stamp}@example.com`);
    await proContext.close();

    const missingReason = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/confirm-completion`, {
      data: { reason: "" },
    });
    expect(missingReason.status()).toBe(400);

    const res = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/confirm-completion`, {
      data: { reason: "Customer unreachable after 3 attempts; work verified via photos." },
    });
    expect(res.status()).toBe(200);

    const jobAfter = await testDb.job.findUnique({ where: { id: job.id } });
    expect(jobAfter!.status).toBe("CONFIRMED");

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "JOB", entityId: job.id, action: "ADMIN_COMPLETION_CONFIRMED" },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as { reason: string }).reason).toContain("Customer unreachable");

    // Never labeled as if the customer confirmed.
    const customerConfirmed = await testDb.auditEvent.findFirst({
      where: { entityType: "JOB", entityId: job.id, action: "CUSTOMER_COMPLETION_CONFIRMED" },
    });
    expect(customerConfirmed).toBeNull();

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    expect(payout!.status).toBe("ELIGIBLE");
  });

  test("an unauthenticated request cannot admin-confirm completion", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const sessionId = `admin-override-unauth-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `admin-override-unauth-pro-${stamp}@example.com`);
    await proContext.close();

    const res = await fetch(`${baseURL}/api/admin/jobs/${job.id}/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "trying without a session" }),
    });
    expect(res.status).toBe(401);
  });
});

test.describe("Mode B manual payout recording (spec sections 46/89)", () => {
  async function seedEligiblePayout(baseURL: string, page: Parameters<typeof advanceToCompleted>[1], seed: string, offerAmountMinor = 40000) {
    const { job } = await seedPaidJob(baseURL, `${seed}-session`);
    const { proContext, offerAmountMinor: amount } = await advanceToCompleted(
      baseURL,
      page,
      job,
      `${seed}-pro@example.com`,
      offerAmountMinor
    );
    await proContext.close();
    const token = await generateCompletionToken(baseURL, page, job.id);
    await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    return { job, payout: payout!, offerAmountMinor: amount };
  }

  test("admin records a payout as paid at the agreed amount — status becomes PAID, audited", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { payout, offerAmountMinor } = await seedEligiblePayout(baseURL!, page, `payout-record-${stamp}`);

    const res = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      data: { amountMinor: offerAmountMinor, methodCategory: "E_TRANSFER", externalReference: "etf-123" },
    });
    expect(res.status()).toBe(200);

    const updated = await testDb.payout.findUnique({ where: { id: payout.id } });
    expect(updated!.status).toBe("PAID");
    expect(updated!.paidAt).not.toBeNull();

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "PAYOUT", entityId: payout.id, action: "PAYOUT_RECORDED" },
    });
    expect(audit).not.toBeNull();
  });

  test("recording an already-paid payout again is idempotent, not an error", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { payout, offerAmountMinor } = await seedEligiblePayout(baseURL!, page, `payout-double-${stamp}`);

    const first = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      data: { amountMinor: offerAmountMinor, methodCategory: "CASH" },
    });
    expect(first.status()).toBe(200);

    const second = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      data: { amountMinor: offerAmountMinor, methodCategory: "CASH" },
    });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data.alreadyRecorded).toBe(true);
  });

  test("a different recorded amount requires an override reason", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { payout, offerAmountMinor } = await seedEligiblePayout(baseURL!, page, `payout-override-${stamp}`);

    const withoutReason = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      data: { amountMinor: offerAmountMinor - 500, methodCategory: "CASH" },
    });
    expect(withoutReason.status()).toBe(400);

    const withReason = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      data: {
        amountMinor: offerAmountMinor - 500,
        methodCategory: "CASH",
        amountOverrideReason: "Professional agreed to a $5 discount for late arrival.",
      },
    });
    expect(withReason.status()).toBe(200);

    const updated = await testDb.payout.findUnique({ where: { id: payout.id } });
    expect(updated!.amountMinor).toBe(offerAmountMinor - 500);
    expect(updated!.amountOverrideReason).toContain("discount");

    // The original agreed offer is preserved, untouched, via the JobOffer relation.
    const offer = await testDb.jobOffer.findUnique({ where: { id: updated!.jobOfferId } });
    expect(offer!.offerAmountMinor).toBe(offerAmountMinor);
  });

  test("an unauthenticated request cannot record a payout", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { payout, offerAmountMinor } = await seedEligiblePayout(baseURL!, page, `payout-unauth-${stamp}`);

    const res = await fetch(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor: offerAmountMinor, methodCategory: "CASH" }),
    });
    expect(res.status).toBe(401);
  });

  test("an unresolved customer issue blocks recording the payout", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const sessionId = `payout-issue-block-${stamp}`;
    const { job } = await seedPaidJob(baseURL!, sessionId);
    const { proContext, offerAmountMinor } = await advanceToCompleted(
      baseURL!,
      page,
      job,
      `payout-issue-block-pro-${stamp}@example.com`
    );
    await proContext.close();

    // Admin overrides completion (customer never responds), THEN an issue
    // is reported via a separately-generated second token — simulating a
    // customer who calls in after admin already closed the loop.
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/confirm-completion`, {
      data: { reason: "No response from customer after 5 days; proceeding." },
    });
    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    expect(payout!.status).toBe("ELIGIBLE");

    await testDb.customerIssueReport.create({
      data: { jobId: job.id, reasonCode: "DAMAGE", note: "Customer called in after all — damage found." },
    });

    const res = await page.request.post(`${baseURL}/api/admin/payouts/${payout!.id}/record`, {
      data: { amountMinor: offerAmountMinor, methodCategory: "CASH" },
    });
    expect(res.status()).toBe(409);

    const unchanged = await testDb.payout.findUnique({ where: { id: payout!.id } });
    expect(unchanged!.status).toBe("ELIGIBLE"); // never silently flipped to PAID
  });
});
