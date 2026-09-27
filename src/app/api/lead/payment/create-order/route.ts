import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { paymentCreateOrderSchema } from "@/lib/server/payment-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { getPaymentProvider } from "@/lib/payments/get-payment-provider";
import { isEnabled } from "@/lib/feature-flags";

const ALREADY_PROCESSED_STATUSES = new Set(["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"]);

/**
 * Creates (or idempotently reuses) the PayPal order backing this job's
 * payment. The amount is always `QuoteSnapshot.totalMinor` — never a
 * client-supplied number, query param, or hidden field (spec section
 * 14). A double-tap or network retry can never create two orders for
 * the same job: `Payment.jobId` is unique, and an existing
 * CREATED/APPROVED order is reused rather than replaced.
 */
export async function POST(request: Request) {
  // Operational kill switch (spec section 17/52) — the customer must
  // never reach a fake payment flow. OFF means a truthful "unavailable"
  // response, never a fabricated success.
  if (!isEnabled("paymentsEnabled")) {
    return apiError("PAYMENTS_UNAVAILABLE", "Payment is temporarily unavailable. Please check back soon.");
  }

  const ip = clientIp(request);
  const rl = checkRateLimit("lead-payment-create-order", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = paymentCreateOrderSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.");

  const lead = await prisma.lead.findUnique({
    where: { sessionId: parsed.data.sessionId },
    include: {
      bookingIntent: { include: { quoteSnapshot: true } },
      job: { include: { payment: true } },
    },
  });

  if (!lead || !lead.bookingIntent || !lead.job) {
    return apiError("INVALID_FUNNEL_STATE", "Please submit your project before paying.");
  }

  const { job } = lead;
  const snapshot = lead.bookingIntent.quoteSnapshot;

  let payment = job.payment;

  if (payment && ALREADY_PROCESSED_STATUSES.has(payment.status)) {
    return apiOk({ alreadyCaptured: true, status: payment.status });
  }

  if (!payment) {
    try {
      payment = await prisma.payment.create({
        data: {
          jobId: job.id,
          quoteSnapshotId: snapshot.id,
          amountMinor: snapshot.totalMinor,
          currency: snapshot.currency,
          status: "PENDING",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Lost a race to a concurrent create for the same job.
        payment = await prisma.payment.findUnique({ where: { jobId: job.id } });
      }
      if (!payment) {
        console.error("[api/lead/payment/create-order] failed to create Payment row", err);
        return apiError("PAYMENT_CREATE_FAILED", "Could not start payment. Please try again.");
      }
    }
  }

  // A live order already exists for this payment — reuse it rather than
  // creating a second one (idempotent double-tap protection).
  if (payment.paypalOrderId && (payment.status === "CREATED" || payment.status === "APPROVED")) {
    return apiOk({
      providerOrderId: payment.paypalOrderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
  }

  const provider = getPaymentProvider();
  // Only ever honored outside production (TestPaymentProvider reads it;
  // PayPalPaymentProvider ignores it) — see payment-schemas.ts.
  const testScenario = process.env.NODE_ENV !== "production" ? parsed.data.testScenario : undefined;

  const result = await provider.createOrder({
    amountMinor: payment.amountMinor,
    currency: "CAD",
    referenceId: payment.id,
    idempotencyKey: `create:${payment.id}`,
    testScenario,
  });

  if (!result.ok) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment!.id }, data: { status: "FAILED" } });
      await recordAuditEvent(
        {
          action: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: payment!.id,
          metadata: { stage: "create_order", reason: result.reason },
        },
        tx
      );
    });
    return apiError("PAYMENT_CREATE_FAILED", "Could not start payment. Please try again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment!.id },
      data: { status: "CREATED", paypalOrderId: result.providerOrderId },
    });
    await tx.paymentEvent.create({
      data: {
        paymentId: payment!.id,
        source: "API",
        eventType: "orders.create",
        resultingStatus: "CREATED",
        summary: { providerOrderId: result.providerOrderId },
      },
    });
    await recordAuditEvent(
      {
        action: "PAYMENT_ORDER_CREATED",
        entityType: "PAYMENT",
        entityId: payment!.id,
        metadata: { jobId: job.id, amountMinor: payment!.amountMinor },
      },
      tx
    );
  });

  return apiOk({ providerOrderId: result.providerOrderId, amountMinor: payment.amountMinor, currency: payment.currency });
}
