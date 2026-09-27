import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

export type PaymentListFilters = {
  status?: string;
  page?: number;
};

/** Lean list — no fake charts, just the real financial facts (spec section 26). */
export async function listPayments(filters: PaymentListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.PaymentWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.EnumPaymentStatusFilter["equals"];

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        job: { include: { lead: { include: { contact: true } } } },
        refunds: true,
      },
    }),
  ]);

  return { payments, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getPaymentDetail(id: string) {
  return prisma.payment.findUnique({
    where: { id },
    include: {
      job: { include: { lead: { include: { contact: true } }, payout: true } },
      quoteSnapshot: { include: { economicsSnapshot: true } },
      events: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "desc" }, include: { requestedByAdmin: { select: { email: true } } } },
    },
  });
}

/**
 * Published PayPal Canada domestic rate (docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md,
 * retrieved from paypal.com/ca/business/paypal-business-fees). This is
 * NOT the provider's own per-transaction reported fee — the capture
 * response this app requests doesn't include PayPal's
 * seller_receivable_breakdown — so it's labeled "approximate" wherever
 * shown, never presented as if it were PayPal's own figure (spec
 * section 68's "never fabricate precision").
 */
const PAYPAL_CA_PERCENT = 0.029;
const PAYPAL_CA_FIXED_MINOR = 30;

export function approximateActualProcessingFeeMinor(capturedAmountMinor: number): number {
  return Math.round(capturedAmountMinor * PAYPAL_CA_PERCENT) + PAYPAL_CA_FIXED_MINOR;
}
