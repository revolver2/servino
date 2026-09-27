import { prisma } from "@/lib/server/prisma";

/**
 * The professional-facing shape of a job — deliberately its own type, not
 * a slice of the admin `Job` include, so it is a compile-time guarantee
 * (not a runtime filter someone could forget) that economics, CAC,
 * margin, quote health, other professionals' data, and unnecessary
 * customer PII can never leak into a /pro response (D037, spec sections
 * 48/49).
 */
export type ProJobView = {
  id: string;
  status: string;
  service: { slug: string | null; totalAreaM2: string | null; styleId: string | null; materialOwnership: string | null };
  timing: string | null;
  location: { citySlug: string | null; postalCode: string | null };
  customer: { firstName: string | null; phone: string | null };
  offerAmountMinor: number | null;
  offeredAt: Date | null;
  assignedAt: Date | null;
  materialResponsibilityNote: string | null;
  /** Truthful payout status only — never customer payment details or Servino margin (spec section 65). Null = not yet eligible. */
  payoutStatus: string | null;
};

const MATERIAL_NOTE_FOR_MATERIAL_AND_INSTALL =
  "Material + installation job — material sourcing is coordinated with Admin (not yet an automatic procurement process). Confirm with Admin before the visit if you're unsure who is bringing material.";

function toView(
  job: {
    id: string;
    status: string;
    assignedAt: Date | null;
    lead: {
      serviceSlug: string | null;
      totalAreaM2: unknown;
      styleId: string | null;
      materialOwnership: string | null;
      citySlug: string | null;
      postalCode: string | null;
      contact: { firstName: string; phone: string } | null;
      timing: { value: string } | null;
    };
  },
  offer: { offerAmountMinor: number; offeredAt: Date } | null,
  revealFullContact: boolean,
  payoutStatus: string | null = null
): ProJobView {
  return {
    id: job.id,
    status: job.status,
    service: {
      slug: job.lead.serviceSlug,
      totalAreaM2: job.lead.totalAreaM2 != null ? String(job.lead.totalAreaM2) : null,
      styleId: job.lead.styleId,
      materialOwnership: job.lead.materialOwnership,
    },
    timing: job.lead.timing?.value ?? null,
    location: {
      citySlug: job.lead.citySlug,
      // Data minimization (D037): full postal code withheld until the
      // professional has actually accepted the job.
      postalCode: revealFullContact ? job.lead.postalCode : null,
    },
    customer: {
      firstName: job.lead.contact?.firstName ?? null,
      // Phone withheld pre-acceptance; email is never included at any
      // stage (spec section 27 — a professional needs a phone number to
      // coordinate a visit, not an inbox).
      phone: revealFullContact ? (job.lead.contact?.phone ?? null) : null,
    },
    offerAmountMinor: offer?.offerAmountMinor ?? null,
    offeredAt: offer?.offeredAt ?? null,
    assignedAt: job.assignedAt,
    materialResponsibilityNote:
      job.lead.materialOwnership === "MATERIAL_AND_INSTALL" ? MATERIAL_NOTE_FOR_MATERIAL_AND_INSTALL : null,
    payoutStatus,
  };
}

const LEAD_INCLUDE = { contact: true, timing: true } as const;

/** Jobs currently offered to this professional, awaiting their response. */
export async function getOfferedJobsForProfessional(professionalId: string): Promise<ProJobView[]> {
  const offers = await prisma.jobOffer.findMany({
    where: { professionalId, status: "OFFERED" },
    orderBy: { offeredAt: "desc" },
    include: { job: { include: { lead: { include: LEAD_INCLUDE } } } },
  });
  return offers.map((o) => toView(o.job, o, false));
}

/** Accepted, not-yet-completed jobs — the professional's active work. */
export async function getActiveJobsForProfessional(professionalId: string): Promise<ProJobView[]> {
  const jobs = await prisma.job.findMany({
    where: { assignedProfessionalId: professionalId, status: { in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] } },
    orderBy: { updatedAt: "desc" },
    include: { lead: { include: LEAD_INCLUDE } },
  });
  const offersByJob = await latestOfferMap(jobs.map((j) => j.id), professionalId);
  return jobs.map((j) => toView(j, offersByJob.get(j.id) ?? null, true));
}

/** Completed (professional-reported), confirmed, or disputed jobs. */
export async function getCompletedJobsForProfessional(professionalId: string): Promise<ProJobView[]> {
  const jobs = await prisma.job.findMany({
    where: { assignedProfessionalId: professionalId, status: { in: ["COMPLETED", "CONFIRMED", "DISPUTED"] } },
    orderBy: { updatedAt: "desc" },
    include: { lead: { include: LEAD_INCLUDE }, payout: { select: { status: true } } },
  });
  const offersByJob = await latestOfferMap(jobs.map((j) => j.id), professionalId);
  return jobs.map((j) => toView(j, offersByJob.get(j.id) ?? null, true, j.payout?.status ?? null));
}

/** Offers this professional declined — for their own reference (spec section 17). */
export async function getDeclinedOffersForProfessional(professionalId: string) {
  return prisma.jobOffer.findMany({
    where: { professionalId, status: "DECLINED" },
    orderBy: { offeredAt: "desc" },
    include: { job: { include: { lead: { include: LEAD_INCLUDE } } } },
  });
}

async function latestOfferMap(jobIds: string[], professionalId: string) {
  if (jobIds.length === 0) return new Map<string, { offerAmountMinor: number; offeredAt: Date }>();
  const offers = await prisma.jobOffer.findMany({
    where: { jobId: { in: jobIds }, professionalId, status: "ACCEPTED" },
    orderBy: { offeredAt: "desc" },
  });
  const map = new Map<string, { offerAmountMinor: number; offeredAt: Date }>();
  for (const o of offers) {
    if (!map.has(o.jobId)) map.set(o.jobId, { offerAmountMinor: o.offerAmountMinor, offeredAt: o.offeredAt });
  }
  return map;
}

/**
 * Single job detail, scoped to this professional's actual relationship to
 * it (IDOR boundary, D037/spec section 15) — returns null for a job that
 * isn't currently offered to or assigned to this professional, exactly
 * like getJobAssignedToProfessional/getOpenOfferForProfessional used by
 * the mutation routes, so the read and write boundaries agree.
 */
export async function getProJobDetail(jobId: string, professionalId: string): Promise<ProJobView | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { lead: { include: LEAD_INCLUDE }, payout: { select: { status: true } } },
  });
  if (!job) return null;

  if (job.assignedProfessionalId === professionalId) {
    const offer = await prisma.jobOffer.findFirst({
      where: { jobId, professionalId, status: "ACCEPTED" },
      orderBy: { offeredAt: "desc" },
    });
    return toView(job, offer, true, job.payout?.status ?? null);
  }

  const openOffer = await prisma.jobOffer.findFirst({ where: { jobId, professionalId, status: "OFFERED" } });
  if (openOffer) return toView(job, openOffer, false);

  return null;
}
