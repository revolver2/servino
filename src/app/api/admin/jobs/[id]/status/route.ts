import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobStatusChangeSchema } from "@/lib/server/admin-schemas";
import { isAllowedJobTransition, type JobStatus } from "@/lib/server/job-status";
import { recordAuditEvent } from "@/lib/server/audit";

// Session F: these statuses each require an associated record this
// generic endpoint has no way to create (OFFERED/ASSIGNED need a
// JobOffer with a professional and amount; EN_ROUTE/ARRIVED are
// professional-declared field events) — routing a manual status change
// into one of them here would produce a job whose status claims more
// than the database actually records. Use the dedicated offer/accept/
// en-route/arrived endpoints instead; this endpoint still handles every
// administrative transition that doesn't need extra context.
const REQUIRES_DEDICATED_ENDPOINT = new Set<JobStatus>(["OFFERED", "ASSIGNED", "EN_ROUTE", "ARRIVED"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = jobStatusChangeSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Invalid status.");

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return adminApiError("NOT_FOUND", "Job not found.");

  const from = job.status as JobStatus;
  const to = parsed.data.status;

  if (REQUIRES_DEDICATED_ENDPOINT.has(to)) {
    return adminApiError(
      "VALIDATION_ERROR",
      `${to} cannot be set directly — use the offer/acceptance workflow instead.`
    );
  }

  if (!isAllowedJobTransition(from, to)) {
    return adminApiError("INVALID_TRANSITION", `Cannot move a job from ${from} to ${to}.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.job.update({ where: { id }, data: { status: to } });
    await recordAuditEvent(
      { action: "JOB_STATUS_CHANGED", entityType: "JOB", entityId: id, actorId: admin.id, metadata: { from, to } },
      tx
    );
    return u;
  });

  return adminApiOk({ status: updated.status });
}
