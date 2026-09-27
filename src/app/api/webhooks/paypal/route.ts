import { NextResponse } from "next/server";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";
import { getPaymentProvider } from "@/lib/payments/get-payment-provider";
import type { NormalizedProviderEvent } from "@/lib/payments/payment-provider";

/**
 * PayPal webhook receiver (spec section 21). Every delivery is verified
 * via `PaymentProvider.verifyWebhook()` (PayPal's own
 * `/v1/notifications/verify-webhook-signature` call, or the test
 * double's HMAC check) BEFORE anything in the payload is trusted — an
 * unverified or malformed body never mutates a Payment. Idempotency is
 * enforced at the database level: `PaymentEvent.providerEventId` is
 * unique, so the same event delivered 1, 10, or 100 times can only ever
 * be applied once (see resolveWebhookEffect below and the P2002 catch).
 *
 * Always reads the raw body text for signature verification — never
 * `request.json()` first, which could re-serialize bytes differently
 * than what was actually signed.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // Generous limit — a legitimate PayPal delivery burst (retries across
  // many events) must never be throttled into false failures.
  const rl = checkRateLimit("webhook-paypal", ip, { windowMs: 60_000, max: 300 });
  if (!rl.allowed) return NextResponse.json({ received: false }, { status: 429 });

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const provider = getPaymentProvider();
  const verification = await provider.verifyWebhook({ headers, rawBody });

  if (!verification.valid) {
    console.error("[api/webhooks/paypal] rejected — verification failed", { reason: verification.reason });
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const { event } = verification;

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        event.providerOrderId ? { paypalOrderId: event.providerOrderId } : undefined,
        event.providerCaptureId ? { paypalCaptureId: event.providerCaptureId } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
    },
    include: { job: { include: { payout: true } } },
  });

  if (!payment) {
    // Unknown-event-safe (spec section 21): no matching Payment (e.g. a
    // webhook for an order this environment never created, or arriving
    // before the create-order response was even persisted). Acknowledge
    // without attempting to mutate anything.
    console.warn("[api/webhooks/paypal] no matching Payment", { eventType: event.eventType, providerEventId: event.providerEventId });
    return NextResponse.json({ received: true, matched: false });
  }

  const effect = resolveWebhookEffect(event, payment.status, payment.amountMinor);

  try {
    await prisma.$transaction(async (tx) => {
      // This insert is the actual idempotency gate — providerEventId is
      // unique, so a duplicate delivery throws P2002 here and nothing
      // past this point ever runs twice.
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          source: "WEBHOOK",
          eventType: event.eventType,
          providerEventId: event.providerEventId,
          resultingStatus: effect?.newStatus ?? payment.status,
          summary: event.summary as Prisma.InputJsonValue,
        },
      });

      if (effect) {
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: { in: effect.allowedFrom } },
          data: { status: effect.newStatus, ...(effect.captureId ? { paypalCaptureId: effect.captureId } : {}) },
        });

        if (claimed.count > 0) {
          await recordAuditEvent(
            {
              action: effect.auditAction,
              entityType: "PAYMENT",
              entityId: payment.id,
              metadata: { eventType: event.eventType, jobId: payment.jobId },
            },
            tx
          );

          if (effect.holdPayout && payment.job?.payout?.status === "ELIGIBLE") {
            await tx.payout.update({
              where: { id: payment.job.payout.id },
              data: { status: "HELD", heldReason: `Payment ${effect.newStatus.toLowerCase()} (${event.eventType}).` },
            });
            await recordAuditEvent(
              {
                action: "PAYOUT_HELD",
                entityType: "PAYOUT",
                entityId: payment.job.payout.id,
                metadata: { reason: event.eventType },
              },
              tx
            );
          }
        }
        // claimed.count === 0: out-of-order or already-applied — the
        // PaymentEvent row above still recorded this delivery, which is
        // enough; nothing further to do (out-of-order-safe).
      }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      (err.meta.target as string[]).includes("providerEventId")
    ) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[api/webhooks/paypal] processing failed", err);
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type WebhookEffect = {
  newStatus: PaymentStatus;
  allowedFrom: PaymentStatus[];
  auditAction: "PAYMENT_CAPTURED" | "PAYMENT_FAILED" | "REFUND_COMPLETED" | "PAYMENT_RECONCILED";
  captureId?: string;
  holdPayout?: boolean;
};

/**
 * Maps a normalized PayPal event to a Payment state transition — or
 * `null` for an event type Session G doesn't act on (still recorded via
 * the PaymentEvent insert above, never dropped silently). Deliberately
 * NOT the spec's full suggested state list — only what real PayPal
 * events actually justify (docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md).
 */
function resolveWebhookEffect(
  event: NormalizedProviderEvent,
  currentStatus: PaymentStatus,
  expectedAmountMinor: number
): WebhookEffect | null {
  switch (event.eventType) {
    case "CHECKOUT.ORDER.APPROVED":
      return { newStatus: PaymentStatus.APPROVED, allowedFrom: [PaymentStatus.CREATED], auditAction: "PAYMENT_RECONCILED" };

    case "PAYMENT.CAPTURE.COMPLETED":
      if (event.amountMinor !== undefined && event.amountMinor !== expectedAmountMinor) {
        // Never trust a capture-completed event whose amount doesn't
        // match what this Payment expects — record-only via the
        // PaymentEvent insert, no status transition.
        return null;
      }
      return {
        newStatus: PaymentStatus.CAPTURED,
        allowedFrom: [PaymentStatus.CREATED, PaymentStatus.APPROVED],
        auditAction: "PAYMENT_CAPTURED",
        captureId: event.providerCaptureId,
      };

    case "PAYMENT.CAPTURE.DENIED":
      return {
        newStatus: PaymentStatus.FAILED,
        allowedFrom: [PaymentStatus.CREATED, PaymentStatus.APPROVED],
        auditAction: "PAYMENT_FAILED",
      };

    case "PAYMENT.CAPTURE.REFUNDED":
      return {
        newStatus: PaymentStatus.REFUNDED,
        allowedFrom: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED],
        auditAction: "REFUND_COMPLETED",
      };

    case "PAYMENT.CAPTURE.REVERSED":
    case "CUSTOMER.DISPUTE.CREATED":
      return {
        newStatus: PaymentStatus.DISPUTED,
        allowedFrom: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
        auditAction: "PAYMENT_RECONCILED",
        holdPayout: true,
      };

    default:
      return null;
  }
}
