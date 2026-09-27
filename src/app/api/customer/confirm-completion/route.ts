import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { confirmationTokenSchema } from "@/lib/server/customer-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { maybeCreatePayoutEligibility } from "@/lib/server/payout-eligibility";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Customer completion confirmation (spec sections 34/44). Distinct from
 * "professional reported completion" (Job.status already COMPLETED
 * before this runs) and from payout eligibility (a separate fact
 * computed by `maybeCreatePayoutEligibility`, not implied by this
 * transition alone). The token is consumed via a conditional update
 * (`usedAt: null` check) — a second request with the same raw token,
 * concurrent or not, can only ever win once.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("customer-confirm-completion", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = confirmationTokenSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.");

  const record = await prisma.completionConfirmationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { job: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return apiError("TOKEN_INVALID", "This link is invalid or has expired.");
  }

  if (record.job.status !== "COMPLETED") {
    return apiError("CONFLICT", "This job isn't ready for confirmation right now.");
  }

  const claimedToken = await prisma.completionConfirmationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimedToken.count === 0) {
    return apiError("CONFLICT", "This link was already used.");
  }

  const claimedJob = await prisma.job.updateMany({
    where: { id: record.jobId, status: "COMPLETED" },
    data: { status: "CONFIRMED" },
  });
  if (claimedJob.count === 0) {
    // Lost a race (e.g. an admin override confirmed it a moment earlier).
    // The token is already spent above; treat this as success — the job
    // is confirmed either way, just not by this specific request.
    return apiOk({ confirmed: true });
  }

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(
      { action: "CUSTOMER_COMPLETION_CONFIRMED", entityType: "JOB", entityId: record.jobId },
      tx
    );
    await maybeCreatePayoutEligibility(tx, record.jobId);
  });

  return apiOk({ confirmed: true });
}
