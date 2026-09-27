import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobOfferCreateSchema } from "@/lib/server/admin-schemas";
import { isAllowedJobTransition, type JobStatus } from "@/lib/server/job-status";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * The real Session F primary path (D035) — offers work to a professional
 * with an explicit compensation amount, requiring their acceptance before
 * the job is actually theirs. Reuses the same job-status transition table
 * as every other status change (D034) rather than a parallel rule set.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = jobOfferCreateSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Choose a professional and a valid offer amount.");

  const [job, professional] = await Promise.all([
    prisma.job.findUnique({ where: { id }, include: { lead: true, payment: true } }),
    prisma.professional.findUnique({ where: { id: parsed.data.professionalId }, include: { services: true } }),
  ]);

  if (!job) return adminApiError("NOT_FOUND", "Job not found.");
  if (!professional) return adminApiError("NOT_FOUND", "Professional not found.");
  // D044 — payment gates professional offer, enforced server-side (not
  // just a disabled button). A job with no captured customer payment can
  // never be offered, regardless of what a crafted request sends.
  if (job.payment?.status !== "CAPTURED") {
    return adminApiError(
      "VALIDATION_ERROR",
      "This job cannot be offered yet — customer payment has not been confirmed."
    );
  }
  if (!professional.active) return adminApiError("VALIDATION_ERROR", "This professional is not active.");
  if (
    job.lead.serviceSlug &&
    !professional.services.some((s) => s.serviceSlug === job.lead.serviceSlug)
  ) {
    return adminApiError(
      "VALIDATION_ERROR",
      "This professional is not set up for this job's service. Add the service to their profile first."
    );
  }

  const from = job.status as JobStatus;
  if (!isAllowedJobTransition(from, "OFFERED")) {
    return adminApiError(
      "INVALID_TRANSITION",
      `Cannot offer this job — it's currently ${from}. Withdraw any open offer first, or move it to Ready for assignment.`
    );
  }

  try {
    const offer = await prisma.$transaction(async (tx) => {
      const created = await tx.jobOffer.create({
        data: {
          jobId: id,
          professionalId: professional.id,
          offerAmountMinor: parsed.data.offerAmountMinor,
          offeredByAdminId: admin.id,
        },
      });
      await tx.job.update({ where: { id }, data: { status: "OFFERED" } });
      await recordAuditEvent(
        {
          action: "JOB_OFFERED",
          entityType: "JOB",
          entityId: id,
          actorId: admin.id,
          metadata: {
            professionalId: professional.id,
            professionalName: professional.displayName,
            offerAmountMinor: parsed.data.offerAmountMinor,
          },
        },
        tx
      );
      return created;
    });

    return adminApiOk({ id: offer.id, jobId: id, professionalId: professional.id, status: "OFFERED" }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost a race against another concurrent offer for the same job —
      // the database's partial unique index (JobOffer_one_open_per_job)
      // is what actually enforced this.
      return adminApiError("CONFLICT", "Another offer was just created for this job. Please refresh and try again.");
    }
    console.error("[api/admin/jobs/offer] failed", err);
    return adminApiError("SERVER_ERROR", "Could not create this offer.");
  }
}
