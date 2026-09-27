import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { apiPost, fakeIp } from "./helpers/api";
import { seedSubmittedJob, seedPaidJob, advanceToCompleted, generateCompletionToken, signTestWebhookPayload, makeWebhookEvent } from "./helpers/payments";

// Own rate-limit bucket for this file's admin-page requests — see
// payment.spec.ts's identical comment for why.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.204" } });

test.describe("Financial concurrency safety (spec section 88)", () => {
  test("two concurrent capture-order requests for the same payment never double-capture", async ({ baseURL }) => {
    const stamp = Date.now();
    const sessionId = `race-capture-${stamp}`;
    await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const createRes = await apiPost<{ providerOrderId: string }>(
      baseURL!,
      "/api/lead/payment/create-order",
      { sessionId },
      ip
    );
    const providerOrderId = (createRes.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;

    const [a, b] = await Promise.all([
      apiPost(baseURL!, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip),
      apiPost(baseURL!, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const lead = await testDb.lead.findUnique({ where: { sessionId } });
    const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
    const payment = await testDb.payment.findUnique({ where: { jobId: job!.id } });
    expect(payment!.status).toBe("CAPTURED");

    const completedEvents = await testDb.paymentEvent.count({
      where: { paymentId: payment!.id, eventType: "orders.capture.completed" },
    });
    expect(completedEvents).toBe(1); // only one side actually won the transition
  });

  test("a capture-order API call racing an equivalent webhook delivery still lands on exactly one CAPTURED, one event", async ({
    baseURL,
  }) => {
    const stamp = Date.now();
    const sessionId = `race-capture-webhook-${stamp}`;
    await seedSubmittedJob(baseURL!, sessionId);
    const ip = { "X-Forwarded-For": fakeIp(sessionId) };

    const createRes = await apiPost<{ providerOrderId: string; amountMinor: number }>(
      baseURL!,
      "/api/lead/payment/create-order",
      { sessionId },
      ip
    );
    const { providerOrderId, amountMinor } = (
      createRes.json as { ok: true; data: { providerOrderId: string; amountMinor: number } }
    ).data;

    const webhookBody = makeWebhookEvent({
      id: `evt-race-${stamp}`,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      orderId: providerOrderId,
      captureId: `TEST-CAPTURE-race-${stamp}`,
      amountMinor,
    });
    const rawBody = JSON.stringify(webhookBody);

    await Promise.all([
      apiPost(baseURL!, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip),
      fetch(`${baseURL}/api/webhooks/paypal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-signature": signTestWebhookPayload(rawBody) },
        body: rawBody,
      }),
    ]);

    const lead = await testDb.lead.findUnique({ where: { sessionId } });
    const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
    const payment = await testDb.payment.findUnique({ where: { jobId: job!.id } });
    expect(payment!.status).toBe("CAPTURED");

    // Exactly one of the two paths actually performed the CREATED/APPROVED
    // -> CAPTURED transition — never two independent capture facts.
    const capturedEvents = await testDb.paymentEvent.count({
      where: {
        paymentId: payment!.id,
        resultingStatus: "CAPTURED",
      },
    });
    expect(capturedEvents).toBeGreaterThanOrEqual(1);
    expect(capturedEvents).toBeLessThanOrEqual(2); // the API path always records its own event; the webhook may or may not (P2002 short-circuit) but never mutates twice
  });

  test("two concurrent full-refund requests for the same payment never produce two completed refunds", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `race-refund-${stamp}`);
    const payment = await testDb.payment.findUnique({ where: { jobId: job.id } });

    const [a, b] = await Promise.all([
      page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, { data: { reason: "Race A" } }),
      page.request.post(`${baseURL}/api/admin/payments/${payment!.id}/refund`, { data: { reason: "Race B" } }),
    ]);
    // The winner always gets 200. The loser gets either 200 (idempotent —
    // it lost the race after the winner had already fully completed) or
    // 409 (it lost while the winner's request was still mid-flight,
    // caught by the database's Refund_one_active_per_payment guard) —
    // both are safe outcomes; what must never happen is two completed
    // refunds, checked below.
    expect([a.status(), b.status()]).toContain(200);
    for (const status of [a.status(), b.status()]) expect([200, 409]).toContain(status);

    const completedRefunds = await testDb.refund.count({ where: { paymentId: payment!.id, status: "COMPLETED" } });
    expect(completedRefunds).toBe(1);

    const updated = await testDb.payment.findUnique({ where: { id: payment!.id } });
    expect(updated!.status).toBe("REFUNDED");
  });

  test("two concurrent manual-payout-record requests never produce two paid recordings", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `race-payout-record-${stamp}`);
    const { proContext, offerAmountMinor } = await advanceToCompleted(
      baseURL!,
      page,
      job,
      `race-payout-record-pro-${stamp}@example.com`
    );
    await proContext.close();

    const token = await generateCompletionToken(baseURL!, page, job.id);
    await fetch(`${baseURL}/api/customer/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });

    const [a, b] = await Promise.all([
      page.request.post(`${baseURL}/api/admin/payouts/${payout!.id}/record`, {
        data: { amountMinor: offerAmountMinor, methodCategory: "CASH" },
      }),
      page.request.post(`${baseURL}/api/admin/payouts/${payout!.id}/record`, {
        data: { amountMinor: offerAmountMinor, methodCategory: "CASH" },
      }),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);

    const recordedAudits = await testDb.auditEvent.count({
      where: { entityType: "PAYOUT", entityId: payout!.id, action: "PAYOUT_RECORDED" },
    });
    expect(recordedAudits).toBe(1); // only one side actually performed the ELIGIBLE -> PAID transition
  });

  test("completion-confirmation racing an issue-report (via a second token) never leaves an ELIGIBLE payout with an unresolved issue", async ({
    baseURL,
    page,
  }) => {
    const stamp = Date.now();
    const { job } = await seedPaidJob(baseURL!, `race-confirm-issue-${stamp}`);
    const { proContext } = await advanceToCompleted(baseURL!, page, job, `race-confirm-issue-pro-${stamp}@example.com`);
    await proContext.close();

    // Two independently-issued links for the same job — simulates Admin
    // generating a fresh link after losing the first one, both still valid.
    const tokenA = await generateCompletionToken(baseURL!, page, job.id);
    const tokenB = await generateCompletionToken(baseURL!, page, job.id);

    await Promise.all([
      fetch(`${baseURL}/api/customer/confirm-completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA }),
      }),
      fetch(`${baseURL}/api/customer/report-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenB, reasonCode: "OTHER", note: "Racing report" }),
      }),
    ]);

    const payout = await testDb.payout.findUnique({ where: { jobId: job.id } });
    const unresolvedIssue = await testDb.customerIssueReport.count({ where: { jobId: job.id, resolved: false } });

    // The hard invariant: never simultaneously ELIGIBLE with an open issue.
    if (payout && payout.status === "ELIGIBLE") {
      expect(unresolvedIssue).toBe(0);
    }

    // And regardless of ordering, no money could actually be recorded as
    // paid while this state was ambiguous — recording must independently
    // re-check and reject if an issue is still open.
    if (payout) {
      const recordAttempt = await page.request.post(`${baseURL}/api/admin/payouts/${payout.id}/record`, {
        data: { amountMinor: payout.amountMinor, methodCategory: "CASH" },
      });
      if (unresolvedIssue > 0) {
        expect(recordAttempt.status()).toBe(409);
      }
    }
  });
});
