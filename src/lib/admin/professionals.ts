import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

export type ProfessionalListFilters = {
  active?: "yes" | "no";
  service?: string;
  q?: string;
};

export async function listProfessionals(filters: ProfessionalListFilters = {}) {
  const where: Prisma.ProfessionalWhereInput = {};
  if (filters.active === "yes") where.active = true;
  if (filters.active === "no") where.active = false;
  if (filters.service) where.services = { some: { serviceSlug: filters.service } };
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }
  }

  return prisma.professional.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      services: true,
      jobs: { where: { status: { in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] } }, select: { id: true } },
    },
  });
}

export async function getProfessionalDetail(id: string) {
  return prisma.professional.findUnique({
    where: { id },
    include: {
      services: true,
      jobs: {
        orderBy: { updatedAt: "desc" },
        include: { lead: { include: { contact: true } }, bookingIntent: { include: { quoteSnapshot: true } } },
      },
      // Session F
      offers: {
        where: { status: "OFFERED" },
        orderBy: { offeredAt: "desc" },
        include: { job: { include: { lead: { include: { contact: true } } } } },
      },
    },
  });
}
