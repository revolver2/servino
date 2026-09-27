import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { payoutRecordSchema } from "@/lib/server/admin-payment-schemas";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Mode B manual payout recording (D039, docs/PAYOUTS.md) — Admin has
 * already paid the professional through an approved external process
 * (e-transfer, cheque, etc.) and is recording that fact here. This
 * route never moves money itself.
 *
 * The hard invariant (spec section 88's "payout race" — issue-open AND
 * payout-incorrectly-paid must never both occur) is enforced HERE,
 * unconditionally, re-checked fresh regardless of what `Payout.status`
 * already claims — this is the actual point real money is being
 * confirmed as sent, so it's where the check has to be airtight, not
 * just at eligibility-computation time (see payout-eligibility.ts).
 *
 * Idempotent: recording an already-PAID payout again returns the
 * existing record rather than erroring or double-processing — but the
 * ELIGIBLE -> PAID transition itself is a conditional update, so two
 * concurrent record attempts can only ever have one actually win.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = payoutRecordSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Enter a valid payout amount and method.");

  const payout = await prisma.payout.findUnique({
    where: { id },
    include: { job: { include: { customerIssueReports: { where: { resolved: false } } } } },
  });
  if (!payout) return adminApiError("NOT_FOUND", "Payout not found.");

  if (payout.status === "PAID") {
    return adminApiOk({ id: payout.id, status: "PAID", alreadyRecorded: true });
  }
  if (payout.status !== "ELIGIBLE") {
    return adminApiError("CONFLICT", `This payout cannot be recorded right now — it's currently ${payout.status}.`);
  }
  if (payout.job.customerIssueReports.length > 0) {
    return adminApiError("CONFLICT", "Cannot record this payout — the job has an unresolved customer issue.");
  }
  if (parsed.data.amountMinor !== payout.amountMinor && !parsed.data.amountOverrideReason) {
    return adminApiError(
      "VALIDATION_ERROR",
      "A reason is required when the recorded amount differs from the agreed offer."
    );
  }

  const claimed = await prisma.payout.updateMany({
    where: { id, status: "ELIGIBLE" },
    data: {
      status: "PAID",
      amountMinor: parsed.data.amountMinor,
      methodCategory: parsed.data.methodCategory,
      externalReference: parsed.data.externalReference,
      note: parsed.data.note,
      amountOverrideReason: parsed.data.amountMinor !== payout.amountMinor ? parsed.data.amountOverrideReason : null,
      paidAt: new Date(),
      recordedByAdminId: admin.id,
    },
  });

  if (claimed.count === 0) {
    const nowState = await prisma.payout.findUnique({ where: { id } });
    if (nowState?.status === "PAID") return adminApiOk({ id, status: "PAID", alreadyRecorded: true });
    return adminApiError("CONFLICT", "This payout could not be recorded. Please refresh and try again.");
  }

  await recordAuditEvent({
    action: "PAYOUT_RECORDED",
    entityType: "PAYOUT",
    entityId: id,
    actorId: admin.id,
    metadata: {
      amountMinor: parsed.data.amountMinor,
      methodCategory: parsed.data.methodCategory,
      overridden: parsed.data.amountMinor !== payout.amountMinor,
    },
  });

  return adminApiOk({ id, status: "PAID" });
}
