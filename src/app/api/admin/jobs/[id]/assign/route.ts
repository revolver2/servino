import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobAssignSchema } from "@/lib/server/admin-schemas";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Manual assignment only (spec section 34) — no matching algorithm, no
 * scoring, no auto-dispatch. The admin picks an explicit, active,
 * service-eligible professional; this route only validates and records
 * that choice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = jobAssignSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Choose a professional to assign.");

  const [job, professional] = await Promise.all([
    prisma.job.findUnique({ where: { id }, include: { lead: true, assignedProfessional: true } }),
    prisma.professional.findUnique({ where: { id: parsed.data.professionalId }, include: { services: true } }),
  ]);

  if (!job) return adminApiError("NOT_FOUND", "Job not found.");
  if (["COMPLETED", "CANCELLED"].includes(job.status)) {
    return adminApiError("INVALID_TRANSITION", "This job is closed and can no longer be assigned.");
  }
  if (!professional) return adminApiError("NOT_FOUND", "Professional not found.");
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

  const previousProfessionalId = job.assignedProfessionalId;
  if (previousProfessionalId === professional.id) {
    return adminApiOk({ id: job.id, assignedProfessionalId: professional.id, unchanged: true });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextStatus = job.status === "READY_FOR_ASSIGNMENT" ? "ASSIGNED" : job.status;
    const u = await tx.job.update({
      where: { id },
      data: { assignedProfessionalId: professional.id, assignedAt: new Date(), status: nextStatus },
    });

    await recordAuditEvent(
      {
        action: previousProfessionalId ? "JOB_REASSIGNED" : "JOB_ASSIGNED",
        entityType: "JOB",
        entityId: id,
        actorId: admin.id,
        metadata: previousProfessionalId
          ? {
              fromProfessionalId: previousProfessionalId,
              fromProfessionalName: job.assignedProfessional?.displayName ?? null,
              toProfessionalId: professional.id,
              toProfessionalName: professional.displayName,
            }
          : { professionalId: professional.id, professionalName: professional.displayName },
      },
      tx
    );

    return u;
  });

  return adminApiOk({ id: updated.id, assignedProfessionalId: updated.assignedProfessionalId, status: updated.status });
}
