import { prisma } from "./prisma";

/**
 * The IDOR/BOLA boundary for every professional-facing job mutation (spec
 * sections 15/56): a professional may only act on a job actually assigned
 * to them. Returns null — never a distinguishable "exists but not yours"
 * vs "doesn't exist" — so a professional probing job IDs learns nothing
 * about jobs that aren't theirs.
 */
export async function getJobAssignedToProfessional(jobId: string, professionalId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.assignedProfessionalId !== professionalId) return null;
  return job;
}

/** Same boundary, for the accept/decline step — before assignedProfessionalId is set, the open JobOffer is what proves the relationship. */
export async function getOpenOfferForProfessional(jobId: string, professionalId: string) {
  const offer = await prisma.jobOffer.findFirst({ where: { jobId, status: "OFFERED" } });
  if (!offer || offer.professionalId !== professionalId) return null;
  return offer;
}
