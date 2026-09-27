import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Lets Admin pull back an open offer (e.g. wrong professional picked, or
 * a decision to reassign before the professional has responded) — spec
 * section 53's "Admin withdraws/reassigns" race partner to acceptance.
 * Uses a conditional update (count-checked) so a professional accepting
 * at the same moment safely wins or loses, never both.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return adminApiError("NOT_FOUND", "Job not found.");

  const openOffer = await prisma.jobOffer.findFirst({ where: { jobId: id, status: "OFFERED" } });
  if (!openOffer) return adminApiError("VALIDATION_ERROR", "There is no open offer on this job to withdraw.");

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobOffer.updateMany({
      where: { id: openOffer.id, status: "OFFERED" },
      data: { status: "WITHDRAWN", respondedAt: new Date() },
    });
    if (claimed.count === 0) return null; // lost the race — professional just responded

    await tx.job.updateMany({
      where: { id, status: "OFFERED" },
      data: { status: "READY_FOR_ASSIGNMENT" },
    });
    await recordAuditEvent(
      {
        action: "JOB_OFFER_WITHDRAWN",
        entityType: "JOB",
        entityId: id,
        actorId: admin.id,
        metadata: { professionalId: openOffer.professionalId },
      },
      tx
    );
    return true;
  });

  if (!updated) {
    return adminApiError("CONFLICT", "The professional already responded to this offer.");
  }

  return adminApiOk({ id, status: "READY_FOR_ASSIGNMENT" });
}
