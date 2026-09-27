import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { customerIssueReportSchema } from "@/lib/server/customer-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { holdPayoutIfEligible } from "@/lib/server/payout-eligibility";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Customer issue report (spec section 39). Flags Admin, preserves
 * evidence, and — critically — does NOT automatically change Job.status
 * and does NOT automatically refund anything. If a Payout already
 * reached ELIGIBLE before this report arrived (the reverse-order half
 * of the confirmation/issue-report race, spec section 88),
 * `holdPayoutIfEligible` catches it in the same transaction.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("customer-report-issue", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = customerIssueReportSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Please choose a reason for your report.");

  const record = await prisma.completionConfirmationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { job: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return apiError("TOKEN_INVALID", "This link is invalid or has expired.");
  }

  const claimedToken = await prisma.completionConfirmationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimedToken.count === 0) {
    return apiError("CONFLICT", "This link was already used.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerIssueReport.create({
      data: {
        jobId: record.jobId,
        reasonCode: parsed.data.reasonCode,
        note: parsed.data.note,
      },
    });
    await recordAuditEvent(
      {
        action: "CUSTOMER_ISSUE_REPORTED",
        entityType: "JOB",
        entityId: record.jobId,
        metadata: { reasonCode: parsed.data.reasonCode },
      },
      tx
    );
    await holdPayoutIfEligible(tx, record.jobId, `Customer reported an issue: ${parsed.data.reasonCode}.`);
  });

  return apiOk({ reported: true });
}
