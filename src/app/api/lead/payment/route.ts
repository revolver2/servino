import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { paymentStatusQuerySchema } from "@/lib/server/payment-schemas";
import { isEnabled } from "@/lib/feature-flags";

/**
 * `/quote/payment` calls this to render the amount to pay and the
 * current payment status — the same trust-boundary pattern as
 * `/api/lead/confirmation` (spec sections 23–24): never trust
 * client-side QuoteState or a query parameter for anything financial,
 * only this server response. A fresh browser / wrong session gets
 * `{ status: "not_found" }`.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-payment-status", ip, { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const url = new URL(request.url);
  const parsed = paymentStatusQuerySchema.safeParse({ sessionId: url.searchParams.get("sessionId") ?? "" });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid session.");

  const lead = await prisma.lead.findUnique({
    where: { sessionId: parsed.data.sessionId },
    include: {
      bookingIntent: { include: { quoteSnapshot: true } },
      job: { include: { payment: true } },
    },
  });

  if (!lead || !lead.bookingIntent || !lead.job) {
    return apiOk({ status: "not_found" as const });
  }

  const snapshot = lead.bookingIntent.quoteSnapshot;
  const payment = lead.job.payment;

  return apiOk({
    status: "found" as const,
    // Lets /quote/payment show a truthful "unavailable" state instead
    // of a payment form that would just fail (spec section 17).
    paymentsEnabled: isEnabled("paymentsEnabled"),
    amount: {
      currency: snapshot.currency,
      subtotalMinor: snapshot.subtotalMinor,
      taxMinor: snapshot.taxMinor,
      taxLabel: snapshot.taxLabel,
      totalMinor: snapshot.totalMinor,
    },
    payment: payment
      ? { status: payment.status, providerOrderId: payment.paypalOrderId }
      : { status: "PENDING" as const, providerOrderId: null },
  });
}
