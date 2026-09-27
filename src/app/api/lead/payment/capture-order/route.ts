import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { paymentCaptureOrderSchema } from "@/lib/server/payment-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { getPaymentProvider } from "@/lib/payments/get-payment-provider";

const CAPTURABLE_STATUSES = new Set<PaymentStatus>([PaymentStatus.CREATED, PaymentStatus.APPROVED]);

/**
 * Server-side-authoritative capture (spec sections 19/20). The client
 * (PayPal button success callback, or the test-provider "Pay now"
 * button) only ever tells this route WHICH order to capture — it is
 * never trusted about whether payment actually succeeded. Three
 * defenses against money tampering, all enforced here regardless of
 * what the request body claims:
 *   1. `providerOrderId` must match the order this server itself
 *      created for this job's Payment row — a forged/foreign order id
 *      is rejected before any provider call.
 *   2. The captured amount/currency returned BY THE PROVIDER must match
 *      `Payment.amountMinor`/currency exactly — a mismatch never
 *      transitions the Payment to CAPTURED.
 *   3. The CREATED/APPROVED -> CAPTURED transition is a conditional
 *      update (count-checked), so a concurrent second capture call (a
 *      double-tap, or a race with the webhook processing the same
 *      capture) can only ever win once; the loser re-reads and returns
 *      the winner's already-captured result instead of erroring or
 *      double-writing (same pattern as `pro-field-transition.ts`).
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-payment-capture-order", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = paymentCaptureOrderSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.");

  const lead = await prisma.lead.findUnique({
    where: { sessionId: parsed.data.sessionId },
    include: { job: { include: { payment: true } } },
  });

  if (!lead || !lead.job || !lead.job.payment) {
    return apiError("INVALID_FUNNEL_STATE", "No payment found for this session.");
  }

  const payment = lead.job.payment;

  if (payment.status === "CAPTURED") {
    return apiOk({ captured: true }); // idempotent double-tap / repeat confirm
  }

  if (payment.paypalOrderId !== parsed.data.providerOrderId) {
    // Never capture an order this server didn't itself create for this
    // payment — closes the "forged/foreign order id" money-tampering path.
    return apiError("VALIDATION_ERROR", "This payment does not match the requested order.");
  }

  if (!CAPTURABLE_STATUSES.has(payment.status)) {
    return apiError("CONFLICT", "This payment cannot be captured right now.");
  }

  const provider = getPaymentProvider();
  const result = await provider.captureOrder({
    providerOrderId: payment.paypalOrderId,
    idempotencyKey: `capture:${payment.id}`,
  });

  if (!result.ok) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          source: "API",
          eventType: "orders.capture.error",
          resultingStatus: "FAILED",
          summary: { reason: result.reason },
        },
      });
      await recordAuditEvent(
        {
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: payment.id,
          metadata: { stage: "capture", reason: result.reason },
        },
        tx
      );
    });
    return apiError("PAYMENT_CAPTURE_FAILED", "Could not confirm your payment. Please try again.");
  }

  if (result.status === "DECLINED") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          source: "API",
          eventType: "orders.capture.declined",
          resultingStatus: "FAILED",
          providerEventId: null,
          summary: { providerCaptureId: result.providerCaptureId },
        },
      });
      await recordAuditEvent(
        {
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: payment.id,
          metadata: { stage: "capture", reason: "DECLINED" },
        },
        tx
      );
    });
    return apiError("PAYMENT_DECLINED", "Your payment was declined. Please try a different payment method.");
  }

  if (result.status === "PENDING") {
    // Real-world PayPal edge case (e.g. eCheck) — approved but not yet
    // final. Stays APPROVED; the eventual webhook (not this request)
    // will move it to CAPTURED or FAILED. Never presented to the
    // customer as "confirmed."
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        source: "API",
        eventType: "orders.capture.pending",
        resultingStatus: "APPROVED",
        summary: { providerCaptureId: result.providerCaptureId },
      },
    });
    return apiOk({ captured: false, pending: true });
  }

  // result.status === "COMPLETED"
  if (result.amountMinor !== payment.amountMinor || result.currency !== payment.currency) {
    // Provider captured a different amount than what Servino asked for
    // — never happens in normal operation, but if it ever does, never
    // mark this CAPTURED. Flag for manual admin reconciliation instead
    // of silently trusting the provider's number over our own.
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          source: "API",
          eventType: "orders.capture.amount_mismatch",
          resultingStatus: payment.status,
          summary: {
            expectedAmountMinor: payment.amountMinor,
            providerAmountMinor: result.amountMinor,
            providerCaptureId: result.providerCaptureId,
          },
        },
      });
      await recordAuditEvent(
        {
          action: "PAYMENT_RECONCILED",
          entityType: "PAYMENT",
          entityId: payment.id,
          metadata: { issue: "amount_mismatch", providerCaptureId: result.providerCaptureId },
        },
        tx
      );
    });
    console.error("[api/lead/payment/capture-order] amount mismatch", {
      paymentId: payment.id,
      expected: payment.amountMinor,
      got: result.amountMinor,
    });
    return apiError("PAYMENT_CAPTURE_FAILED", "Could not confirm your payment. Please contact support.");
  }

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: Array.from(CAPTURABLE_STATUSES) } },
    data: { status: "CAPTURED", paypalCaptureId: result.providerCaptureId },
  });

  if (claimed.count === 0) {
    // Lost a race — either our own double-tap's other request just won,
    // or the webhook got there first. Either way, re-read: if it's now
    // CAPTURED, this is success, not an error.
    const nowState = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (nowState?.status === "CAPTURED") return apiOk({ captured: true });
    return apiError("CONFLICT", "This payment could not be confirmed. Please refresh and try again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        source: "API",
        eventType: "orders.capture.completed",
        resultingStatus: "CAPTURED",
        summary: { providerCaptureId: result.providerCaptureId },
      },
    });
    await recordAuditEvent(
      {
        action: "PAYMENT_CAPTURED",
        entityType: "PAYMENT",
        entityId: payment.id,
        metadata: { jobId: lead.job!.id, amountMinor: payment.amountMinor, providerCaptureId: result.providerCaptureId },
      },
      tx
    );
    await tx.lead.update({ where: { id: lead.id }, data: { currentStep: "CONFIRMATION" } });
  });

  return apiOk({ captured: true });
}
