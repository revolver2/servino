import { prisma } from "@/lib/server/prisma";
import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { isSameOrigin, requireProfessionalSession } from "@/lib/server/pro-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobProblemReportSchema } from "@/lib/server/pro-schemas";
import { getJobAssignedToProfessional } from "@/lib/server/pro-job-access";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * A flag for Admin attention, not a status transition (D036) — the job
 * stays exactly where it was; Admin decides whether/how to change its
 * status. The professional can report this from any active stage of the
 * job (assigned through in-progress) — a problem doesn't wait for a
 * particular field-progress step.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const professional = await requireProfessionalSession();
  if (!professional) return proApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("professional-mutation", clientIp(request), { windowMs: 60_000, max: 30 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = jobProblemReportSchema.safeParse(json);
  if (!parsed.success) return proApiError("VALIDATION_ERROR", "Choose a reason for the problem.");

  const job = await getJobAssignedToProfessional(id, professional.id);
  if (!job) return proApiError("NOT_FOUND", "Job not found.");
  if (!["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(job.status)) {
    return proApiError("VALIDATION_ERROR", "A problem can only be reported on an active job.");
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.problemReport.create({
      data: {
        jobId: id,
        professionalId: professional.id,
        reasonCode: parsed.data.reasonCode,
        note: parsed.data.note ?? null,
      },
    });
    await recordAuditEvent(
      {
        action: "JOB_PROBLEM_REPORTED",
        entityType: "JOB",
        entityId: id,
        actorProfessionalId: professional.id,
        metadata: { reasonCode: parsed.data.reasonCode },
      },
      tx
    );
    return created;
  });

  return proApiOk({ id: report.id, jobId: id }, 201);
}
