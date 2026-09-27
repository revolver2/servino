import { prisma } from "@/lib/server/prisma";
import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { isSameOrigin, requireProfessionalSession } from "@/lib/server/pro-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobDeclineSchema } from "@/lib/server/pro-schemas";
import { getOpenOfferForProfessional } from "@/lib/server/pro-job-access";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * A decline never penalizes the professional (spec section 25) — it's
 * just recorded, the job returns to the admin's pool for re-offering
 * (never automatically to another professional — spec section 26), and
 * the original decline stays in history even after the job is later
 * offered to and accepted by someone else (spec section 64).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const professional = await requireProfessionalSession();
  if (!professional) return proApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("professional-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = jobDeclineSchema.safeParse(json ?? {});
  if (!parsed.success) return proApiError("VALIDATION_ERROR", "Invalid decline reason.");

  const offer = await getOpenOfferForProfessional(id, professional.id);

  if (!offer) {
    const existing = await prisma.jobOffer.findFirst({
      where: { jobId: id, professionalId: professional.id, status: "DECLINED" },
      orderBy: { offeredAt: "desc" },
    });
    if (existing) return proApiOk({ id, status: "DECLINED", alreadyDeclined: true });
    return proApiError("NOT_FOUND", "This job offer is no longer available.");
  }

  const claimed = await prisma.jobOffer.updateMany({
    where: { id: offer.id, status: "OFFERED" },
    data: {
      status: "DECLINED",
      declineReason: parsed.data.reason ?? null,
      declineNote: parsed.data.note ?? null,
      respondedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    return proApiError("CONFLICT", "This offer is no longer open.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.updateMany({
      where: { id, status: "OFFERED" },
      data: { status: "READY_FOR_ASSIGNMENT" },
    });
    await recordAuditEvent(
      {
        action: "JOB_OFFER_DECLINED",
        entityType: "JOB",
        entityId: id,
        actorProfessionalId: professional.id,
        metadata: { reason: parsed.data.reason ?? null },
      },
      tx
    );
  });

  return proApiOk({ id, status: "READY_FOR_ASSIGNMENT" });
}
