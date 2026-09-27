import { prisma } from "./prisma";
import { isAllowedJobTransition, type JobStatus } from "./job-status";
import { recordAuditEvent } from "./audit";
import { getJobAssignedToProfessional } from "./pro-job-access";

type FieldAuditAction = "JOB_EN_ROUTE" | "JOB_ARRIVED" | "JOB_STARTED" | "JOB_COMPLETION_REPORTED";

/**
 * Shared shape for every professional field-progress action (en route,
 * arrived, start, complete) — server-authoritative (spec section 54: the
 * client never decides validity, only displays what the server already
 * allowed), conditional-update concurrency-safe (spec section 53), and
 * idempotent against a double-tap (spec section 52): a repeat call when
 * already at the target status succeeds as a no-op rather than erroring.
 */
export async function performProfessionalFieldTransition(args: {
  jobId: string;
  professionalId: string;
  to: JobStatus;
  auditAction: FieldAuditAction;
}): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "CONFLICT" }> {
  const job = await getJobAssignedToProfessional(args.jobId, args.professionalId);
  if (!job) return { ok: false, code: "NOT_FOUND" };

  const from = job.status as JobStatus;
  if (from === args.to) return { ok: true }; // already there — double-tap, not an error

  if (!isAllowedJobTransition(from, args.to)) {
    return { ok: false, code: "CONFLICT" };
  }

  const claimed = await prisma.job.updateMany({
    where: { id: args.jobId, status: from },
    data: { status: args.to },
  });
  if (claimed.count === 0) {
    // Lost a race. Two distinct causes look identical here: (a) this same
    // professional double-tapped concurrently and their OTHER request just
    // won — still success, not an error (spec section 52 covers concurrent
    // double-taps, not just sequential retries, same reasoning as the
    // accept route's own race-loser check); (b) something else changed the
    // job's status in between (e.g. Admin moved it to MANUAL_REVIEW) — a
    // real conflict. Distinguish by re-reading current state.
    const nowState = await prisma.job.findUnique({ where: { id: args.jobId } });
    if (nowState?.status === args.to) return { ok: true };
    return { ok: false, code: "CONFLICT" };
  }

  await recordAuditEvent({
    action: args.auditAction,
    entityType: "JOB",
    entityId: args.jobId,
    actorProfessionalId: args.professionalId,
  });

  return { ok: true };
}
