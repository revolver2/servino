import { prisma } from "@/lib/server/prisma";
import { formatCadMinor } from "@/lib/quote/units";
import { reasonCodeLabel } from "@/lib/admin/status-display";

export type TimelineEvent = {
  at: Date;
  label: string;
};

type LabelBuilder = (metadata: unknown, actorEmail: string | null, actorProfessionalName: string | null) => string;

const AUDIT_LABEL: Record<string, LabelBuilder> = {
  JOB_STATUS_CHANGED: (metadata, actor) => {
    const m = metadata as { from?: string; to?: string } | null;
    return `${actor ?? "Admin"} changed status${m?.from && m?.to ? ` from ${m.from} to ${m.to}` : ""}`;
  },
  JOB_ASSIGNED: (metadata, actor) => {
    const m = metadata as { professionalName?: string } | null;
    return `${actor ?? "Admin"} assigned ${m?.professionalName ?? "a professional"}`;
  },
  JOB_REASSIGNED: (metadata, actor) => {
    const m = metadata as { fromProfessionalName?: string; toProfessionalName?: string } | null;
    return `${actor ?? "Admin"} reassigned from ${m?.fromProfessionalName ?? "previous professional"} to ${
      m?.toProfessionalName ?? "new professional"
    }`;
  },
  // Session F
  JOB_OFFERED: (metadata, actor) => {
    const m = metadata as { professionalName?: string; offerAmountMinor?: number } | null;
    return `${actor ?? "Admin"} offered this job to ${m?.professionalName ?? "a professional"}${
      m?.offerAmountMinor != null ? ` for ${formatCadMinor(m.offerAmountMinor)}` : ""
    }`;
  },
  JOB_OFFER_WITHDRAWN: (_metadata, actor) => `${actor ?? "Admin"} withdrew the offer`,
  JOB_OFFER_ACCEPTED: (_metadata, _actor, pro) => `${pro ?? "The professional"} accepted the offer`,
  JOB_OFFER_DECLINED: (metadata, _actor, pro) => {
    const m = metadata as { reason?: string | null } | null;
    return `${pro ?? "The professional"} declined the offer${m?.reason ? ` (${reasonCodeLabel(m.reason)})` : ""}`;
  },
  JOB_EN_ROUTE: (_metadata, _actor, pro) => `${pro ?? "The professional"} is en route`,
  JOB_ARRIVED: (_metadata, _actor, pro) => `${pro ?? "The professional"} arrived on site`,
  JOB_STARTED: (_metadata, _actor, pro) => `${pro ?? "The professional"} started the job`,
  JOB_COMPLETION_REPORTED: (_metadata, _actor, pro) => `${pro ?? "The professional"} reported the job complete`,
  JOB_PROBLEM_REPORTED: (metadata, _actor, pro) => {
    const m = metadata as { reasonCode?: string } | null;
    return `${pro ?? "The professional"} reported a problem${m?.reasonCode ? `: ${reasonCodeLabel(m.reasonCode)}` : ""}`;
  },
};

/**
 * Chronological, human-readable job history (spec section 39) — merges
 * the real customer-funnel timestamps already on Lead/QuoteSnapshot/
 * ContactInfo/TimingSelection/BookingIntent with real AuditEvent rows for
 * this job. Every entry traces back to an actual database timestamp.
 */
export async function getJobTimeline(jobId: string): Promise<TimelineEvent[]> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      lead: { include: { contact: true, timing: true, quoteSnapshots: { orderBy: { createdAt: "asc" } } } },
      bookingIntent: true,
    },
  });
  if (!job) return [];

  const events: TimelineEvent[] = [
    { at: job.lead.createdAt, label: "Customer started a project request" },
  ];

  for (const snapshot of job.lead.quoteSnapshots) {
    events.push({ at: snapshot.createdAt, label: "Quote generated" });
  }
  if (job.lead.contact) {
    events.push({ at: job.lead.contact.createdAt, label: "Contact details captured" });
  }
  if (job.lead.timing) {
    events.push({ at: job.lead.timing.createdAt, label: "Timing preference submitted" });
  }
  if (job.bookingIntent) {
    events.push({ at: job.bookingIntent.createdAt, label: "Project request submitted — job created" });
  }

  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityType: "JOB", entityId: jobId, action: { not: "JOB_CREATED" } },
    include: { actor: { select: { email: true } }, actorProfessional: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const a of auditEvents) {
    const build = AUDIT_LABEL[a.action];
    events.push({
      at: a.createdAt,
      label: build ? build(a.metadata, a.actor?.email ?? null, a.actorProfessional?.displayName ?? null) : a.action,
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
