import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

export type LeadListFilters = {
  status?: string;
  service?: string;
  source?: string;
  bookingIntent?: "yes" | "no";
  q?: string;
  days?: number;
  page?: number;
};

export async function listLeads(filters: LeadListFilters) {
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.LeadWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.EnumLeadStatusFilter["equals"];
  if (filters.service) where.serviceSlug = filters.service;
  if (filters.source) where.attribution = { utmSource: filters.source };
  if (filters.bookingIntent === "yes") where.bookingIntent = { isNot: null };
  if (filters.bookingIntent === "no") where.bookingIntent = { is: null };
  if (filters.days) where.createdAt = { gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000) };

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { id: q },
        { sessionId: q },
        { contact: { firstName: { contains: q, mode: "insensitive" } } },
        { contact: { email: { contains: q, mode: "insensitive" } } },
        { contact: { phone: { contains: q } } },
      ];
    }
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        contact: true,
        timing: true,
        attribution: true,
        bookingIntent: true,
        quoteSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  return { leads, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      contact: true,
      timing: true,
      attribution: true,
      consents: { orderBy: { grantedAt: "desc" } },
      quoteSnapshots: { orderBy: { createdAt: "desc" } },
      bookingIntent: { include: { quoteSnapshot: true } },
      job: true,
    },
  });
}
