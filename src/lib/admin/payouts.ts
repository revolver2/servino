import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

export type PayoutListFilters = {
  status?: string;
  page?: number;
};

export async function listPayouts(filters: PayoutListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.PayoutWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.EnumPayoutStatusFilter["equals"];

  const [total, payouts] = await Promise.all([
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        professional: { select: { displayName: true } },
        job: { include: { payment: true, customerIssueReports: { where: { resolved: false } } } },
      },
    }),
  ]);

  return { payouts, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getPayoutDetail(id: string) {
  return prisma.payout.findUnique({
    where: { id },
    include: {
      professional: true,
      jobOffer: true,
      recordedByAdmin: { select: { email: true } },
      job: {
        include: {
          payment: true,
          customerIssueReports: { orderBy: { reportedAt: "desc" } },
          lead: { include: { contact: true } },
        },
      },
    },
  });
}
