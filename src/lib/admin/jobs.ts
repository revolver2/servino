import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

export type JobListFilters = {
  status?: string;
  service?: string;
  assigned?: "yes" | "no";
  q?: string;
  page?: number;
};

export async function listJobs(filters: JobListFilters) {
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.JobWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.EnumJobStatusFilter["equals"];
  if (filters.assigned === "yes") where.assignedProfessionalId = { not: null };
  if (filters.assigned === "no") where.assignedProfessionalId = null;
  if (filters.service) where.lead = { serviceSlug: filters.service };

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { id: q },
        { lead: { contact: { firstName: { contains: q, mode: "insensitive" } } } },
        { lead: { contact: { email: { contains: q, mode: "insensitive" } } } },
        { lead: { contact: { phone: { contains: q } } } },
      ];
    }
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        lead: { include: { contact: true, timing: true } },
        bookingIntent: { include: { quoteSnapshot: true } },
        assignedProfessional: true,
      },
    }),
  ]);

  return { jobs, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getJobDetail(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      lead: { include: { contact: true, timing: true, attribution: true } },
      bookingIntent: {
        include: {
          quoteSnapshot: {
            include: { economicsSnapshot: true, pricingVersion: { select: { label: true, status: true } } },
          },
        },
      },
      assignedProfessional: true,
      // Session F
      offers: { orderBy: { offeredAt: "desc" }, include: { professional: { select: { displayName: true } } } },
      problemReports: {
        orderBy: { reportedAt: "desc" },
        include: { professional: { select: { displayName: true } } },
      },
      // Session G
      payment: { include: { refunds: true } },
      payout: true,
      customerIssueReports: { orderBy: { reportedAt: "desc" } },
      // Session H
      jobActuals: true,
    },
  });
}

const FIELD_TIMESTAMP_ACTIONS = ["JOB_EN_ROUTE", "JOB_ARRIVED", "JOB_STARTED", "JOB_COMPLETION_REPORTED"] as const;

/**
 * The field-progress timestamps spec section 37 wants shown structurally
 * (not just in the prose Timeline card) — sourced from AuditEvent rather
 * than dedicated Job columns, since Job's own `updatedAt` is overwritten
 * on every transition and can't hold four independent moments at once.
 */
export async function getJobFieldTimestamps(jobId: string) {
  const rows = await prisma.auditEvent.findMany({
    where: { entityType: "JOB", entityId: jobId, action: { in: [...FIELD_TIMESTAMP_ACTIONS] } },
    orderBy: { createdAt: "asc" },
  });
  const map: Partial<Record<(typeof FIELD_TIMESTAMP_ACTIONS)[number], Date>> = {};
  for (const row of rows) {
    map[row.action as (typeof FIELD_TIMESTAMP_ACTIONS)[number]] = row.createdAt;
  }
  return map;
}
