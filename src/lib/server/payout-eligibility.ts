import type { Prisma } from "@prisma/client";
import { recordAuditEvent } from "./audit";

type Tx = Prisma.TransactionClient;

/**
 * Payout eligibility (D043) — computed live, never stored as a
 * separate boolean. "Not yet eligible" is represented by the absence
 * of a Payout row for the job, not a stored NOT_ELIGIBLE value.
 *
 * Called at the two moments completion can become CONFIRMED (customer
 * confirmation and admin override) rather than on a schedule — this
 * project deliberately avoids background/cron jobs at this scale (same
 * reasoning as Session E's pricing reconciliation and Session F's offer
 * expiration). Must run inside the SAME transaction as the Job status
 * transition that triggered it, so the "no unresolved issue" check
 * below sees fresh data, not a stale read from before the transition
 * started — this is what closes the confirmation/issue-report race
 * (spec section 88): whichever of the two transactions commits first
 * wins the true state, and the other sees it.
 *
 * Minimum conditions (spec section 44), all checked fresh here:
 *   - customer payment CAPTURED
 *   - an ACCEPTED JobOffer exists (the payout amount authority, D042)
 *   - no unresolved CustomerIssueReport
 * A Payout row is created at most once per job (jobId is unique) —
 * calling this again for an already-materialized job is a safe no-op.
 */
export async function maybeCreatePayoutEligibility(tx: Tx, jobId: string): Promise<void> {
  const existing = await tx.payout.findUnique({ where: { jobId } });
  if (existing) return;

  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: {
      payment: true,
      offers: { where: { status: "ACCEPTED" } },
      customerIssueReports: { where: { resolved: false } },
    },
  });

  if (!job || !job.payment || job.payment.status !== "CAPTURED") return;
  if (job.customerIssueReports.length > 0) return;

  const acceptedOffer = job.offers[0];
  if (!acceptedOffer) return;

  const payout = await tx.payout.create({
    data: {
      jobId,
      professionalId: acceptedOffer.professionalId,
      jobOfferId: acceptedOffer.id,
      amountMinor: acceptedOffer.offerAmountMinor,
      status: "ELIGIBLE",
    },
  });

  // Defense-in-depth against the confirmation/issue-report race (spec
  // section 88): under READ COMMITTED, a concurrent report-issue
  // transaction could commit strictly between this function's initial
  // SELECT above and this point without either side observing the
  // other. Re-checking now (a fresh statement sees any newly-committed
  // issue) closes all but a vanishingly narrow remaining window — the
  // actual hard invariant ("never pay out while an issue is open") is
  // enforced again, unconditionally, at payout-recording time
  // (src/app/api/admin/payouts/[id]/record/route.ts), which is where
  // real money would actually move.
  const stillClean = await tx.customerIssueReport.count({ where: { jobId, resolved: false } });
  if (stillClean > 0) {
    await tx.payout.update({
      where: { id: payout.id },
      data: { status: "HELD", heldReason: "Customer issue reported." },
    });
    await recordAuditEvent(
      { action: "PAYOUT_HELD", entityType: "PAYOUT", entityId: payout.id, metadata: { jobId, reason: "race_recheck" } },
      tx
    );
    return;
  }

  await recordAuditEvent(
    {
      action: "PAYOUT_ELIGIBLE",
      entityType: "PAYOUT",
      entityId: payout.id,
      metadata: { jobId, professionalId: acceptedOffer.professionalId, amountMinor: payout.amountMinor },
    },
    tx
  );
}

/**
 * The reverse-order half of the same race (spec section 88): an issue
 * reported AFTER a Payout row already reached ELIGIBLE. Holds it within
 * the same transaction as creating the CustomerIssueReport, via a
 * conditional update (only from ELIGIBLE) so this never clobbers a
 * Payout that's already PAID — see docs/PAYOUTS.md "already paid"
 * edge case for why that case is handled separately (Admin Action
 * Required), not by this function.
 */
export async function holdPayoutIfEligible(tx: Tx, jobId: string, reason: string): Promise<void> {
  const payout = await tx.payout.findUnique({ where: { jobId } });
  if (!payout || payout.status !== "ELIGIBLE") return;

  const claimed = await tx.payout.updateMany({
    where: { id: payout.id, status: "ELIGIBLE" },
    data: { status: "HELD", heldReason: reason },
  });

  if (claimed.count > 0) {
    await recordAuditEvent(
      { action: "PAYOUT_HELD", entityType: "PAYOUT", entityId: payout.id, metadata: { jobId, reason } },
      tx
    );
  }
}
