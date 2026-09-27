import { prisma } from "@/lib/server/prisma";
import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { isSameOrigin, requireProfessionalSession } from "@/lib/server/pro-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { getOpenOfferForProfessional } from "@/lib/server/pro-job-access";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Accept is transactional and idempotent (spec section 24/52): a double-
 * tap, refresh, or slow-network retry resolves to the same accepted
 * state, never a duplicate history entry or an error.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const professional = await requireProfessionalSession();
  if (!professional) return proApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("professional-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const offer = await getOpenOfferForProfessional(id, professional.id);

  if (!offer) {
    // Either no open offer exists for this job/professional pair, or it
    // was already accepted by this same professional (double-tap) — check
    // the latter before treating this as an error.
    const existing = await prisma.jobOffer.findFirst({
      where: { jobId: id, professionalId: professional.id, status: "ACCEPTED" },
      orderBy: { offeredAt: "desc" },
    });
    if (existing) return proApiOk({ id, status: "ASSIGNED", alreadyAccepted: true });
    return proApiError("NOT_FOUND", "This job offer is no longer available.");
  }

  const claimed = await prisma.jobOffer.updateMany({
    where: { id: offer.id, status: "OFFERED" },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });

  if (claimed.count === 0) {
    // Lost a race. Two distinct causes look identical at this point:
    //   (a) this same professional double-tapped Accept concurrently, and
    //       their OTHER request just won — that's still success, not an
    //       error (spec section 52's idempotency requirement applies to
    //       concurrent double-taps, not just sequential retries);
    //   (b) Admin withdrew the offer at the same moment — a real conflict.
    // Distinguish by re-reading the offer's current state.
    const nowState = await prisma.jobOffer.findUnique({ where: { id: offer.id } });
    if (nowState?.status === "ACCEPTED" && nowState.professionalId === professional.id) {
      return proApiOk({ id, status: "ASSIGNED", alreadyAccepted: true });
    }
    return proApiError("CONFLICT", "This offer is no longer open.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.updateMany({
      where: { id, status: "OFFERED" },
      data: { status: "ASSIGNED", assignedProfessionalId: professional.id, assignedAt: new Date() },
    });
    await recordAuditEvent(
      {
        action: "JOB_OFFER_ACCEPTED",
        entityType: "JOB",
        entityId: id,
        actorProfessionalId: professional.id,
        metadata: { offerAmountMinor: offer.offerAmountMinor },
      },
      tx
    );
  });

  return proApiOk({ id, status: "ASSIGNED" });
}
