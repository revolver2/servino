import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { refundCreateSchema } from "@/lib/server/admin-payment-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { getPaymentProvider } from "@/lib/payments/get-payment-provider";

/**
 * Smallest safe refund foundation (spec section 50) — full refund only,
 * admin-only, server-authoritative amount (always exactly what was
 * captured, never a client-supplied number). A refund is not "done"
 * because this route returns 200 — the Refund row starts PENDING
 * before the provider call and only becomes COMPLETED once the
 * provider's own synchronous response confirms it, mirroring how
 * capture is never trusted before the provider itself confirms it.
 *
 * Two edge cases this route handles explicitly rather than pretending
 * don't exist (spec section 51):
 *   - Payout still ELIGIBLE (not yet paid) -> held, so a refunded job
 *     can never proceed to a manual payout.
 *   - Payout already PAID -> money already left Servino; this does NOT
 *     silently reverse. The response flags `payoutAlreadyPaid: true` so
 *     Admin knows manual reconciliation with the professional may be
 *     needed — same fact also surfaces in Admin's Action Required list
 *     (a live computed condition, not a stored flag).
 *
 * Concurrency (spec section 88): two simultaneous refund requests for
 * the same payment both passing the initial `status === "CAPTURED"`
 * read is a real race — an application-level check alone isn't enough,
 * because by the time either commits anything, both could have already
 * decided to proceed. The actual guard is the database's own
 * `Refund_one_active_per_payment` partial unique index (migration
 * `20260924120104_session_g_refund_race_guard`): only one PENDING/
 * COMPLETED Refund row can ever exist per payment, so the loser's own
 * `refund.create` fails with P2002 before it ever calls the provider.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 30 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = refundCreateSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "A reason is required to issue a refund.");

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { job: { include: { payout: true } } },
  });
  if (!payment) return adminApiError("NOT_FOUND", "Payment not found.");

  if (payment.status === "REFUNDED") {
    return adminApiOk({ id: payment.id, status: "REFUNDED", alreadyRefunded: true });
  }
  if (payment.status !== "CAPTURED" || !payment.paypalCaptureId) {
    return adminApiError("CONFLICT", "This payment cannot be refunded right now — it was never captured.");
  }

  let refund;
  try {
    refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        status: "PENDING",
        reason: parsed.data.reason,
        requestedByAdminId: admin.id,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      (err.meta.target as string[]).includes("paymentId")
    ) {
      // Lost a race to a concurrent refund request for the same payment.
      const nowState = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (nowState?.status === "REFUNDED") {
        return adminApiOk({ id: payment.id, status: "REFUNDED", alreadyRefunded: true });
      }
      return adminApiError("CONFLICT", "A refund is already being processed for this payment.");
    }
    console.error("[api/admin/payments/refund] failed to create Refund row", err);
    return adminApiError("SERVER_ERROR", "Could not start this refund. Please try again.");
  }

  await recordAuditEvent({
    action: "REFUND_INITIATED",
    entityType: "PAYMENT",
    entityId: payment.id,
    actorId: admin.id,
    metadata: { refundId: refund.id, amountMinor: payment.amountMinor },
  });

  const provider = getPaymentProvider();
  const result = await provider.refundPayment({
    providerCaptureId: payment.paypalCaptureId,
    currency: "CAD",
    idempotencyKey: `refund:${payment.id}`,
  });

  if (!result.ok) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    return adminApiError("SERVER_ERROR", "The refund could not be processed. Please try again.");
  }

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "CAPTURED" },
    data: { status: "REFUNDED" },
  });

  let payoutAlreadyPaid = false;

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: { status: "COMPLETED", paypalRefundId: result.providerRefundId, completedAt: new Date() },
    });

    if (claimed.count > 0) {
      await recordAuditEvent(
        {
          action: "REFUND_COMPLETED",
          entityType: "PAYMENT",
          entityId: payment.id,
          actorId: admin.id,
          metadata: { refundId: refund.id, providerRefundId: result.providerRefundId },
        },
        tx
      );
    }

    const payout = payment.job?.payout;
    if (payout?.status === "ELIGIBLE") {
      await tx.payout.updateMany({
        where: { id: payout.id, status: "ELIGIBLE" },
        data: { status: "HELD", heldReason: "Payment was refunded." },
      });
      await recordAuditEvent(
        { action: "PAYOUT_HELD", entityType: "PAYOUT", entityId: payout.id, metadata: { reason: "refund" } },
        tx
      );
    } else if (payout?.status === "PAID") {
      payoutAlreadyPaid = true;
    }
  });

  return adminApiOk({ id: payment.id, status: "REFUNDED", providerRefundId: result.providerRefundId, payoutAlreadyPaid });
}
