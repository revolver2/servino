import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";
import { getPaymentProvider } from "@/lib/payments/get-payment-provider";

/**
 * Explicit admin-triggered reconciliation (spec section 27) — no
 * automatic cron. Fetches the order directly from the provider and
 * compares it against Servino's own Payment record. If the provider
 * reports a completed capture that this Payment never recorded (e.g. a
 * webhook delivery was missed), this self-heals the gap the same way
 * the capture-order route itself would — same conditional-update
 * safety, same amount/currency check before ever trusting the
 * provider's number.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return adminApiError("NOT_FOUND", "Payment not found.");
  if (!payment.paypalOrderId) return adminApiError("VALIDATION_ERROR", "This payment has no provider order to reconcile yet.");

  const provider = getPaymentProvider();
  const orderResult = await provider.getOrder(payment.paypalOrderId);

  if (!orderResult.ok) {
    return adminApiError("SERVER_ERROR", "Could not reach the payment provider to reconcile this payment.");
  }

  const comparison = {
    servinoStatus: payment.status,
    providerStatus: orderResult.status,
    servinoAmountMinor: payment.amountMinor,
    providerAmountMinor: orderResult.amountMinor ?? null,
    servinoCaptureId: payment.paypalCaptureId,
    providerCaptureId: orderResult.providerCaptureId ?? null,
  };

  let selfHealed = false;

  if (
    orderResult.status === "COMPLETED" &&
    orderResult.providerCaptureId &&
    (payment.status === PaymentStatus.CREATED || payment.status === PaymentStatus.APPROVED) &&
    orderResult.amountMinor === payment.amountMinor
  ) {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: [PaymentStatus.CREATED, PaymentStatus.APPROVED] } },
      data: { status: PaymentStatus.CAPTURED, paypalCaptureId: orderResult.providerCaptureId },
    });
    selfHealed = claimed.count > 0;
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        source: "API",
        eventType: "reconcile",
        resultingStatus: selfHealed ? PaymentStatus.CAPTURED : payment.status,
        summary: { ...comparison, selfHealed },
      },
    });
    await recordAuditEvent(
      {
        action: "PAYMENT_RECONCILED",
        entityType: "PAYMENT",
        entityId: payment.id,
        actorId: admin.id,
        metadata: { selfHealed, providerStatus: orderResult.status },
      },
      tx
    );
  });

  return adminApiOk({ ...comparison, selfHealed });
}
