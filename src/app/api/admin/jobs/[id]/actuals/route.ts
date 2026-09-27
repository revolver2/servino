import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { jobActualsUpsertSchema } from "@/lib/server/admin-economics-schemas";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Post-job actual-cost capture (spec sections 38–40) — an upsert, not a
 * one-time create: Admin may learn/correct a number after the fact, and
 * every save is audited with the new values (never silently). This
 * never touches `EconomicsSnapshot` (Session E's immutable estimate) —
 * see docs/UNIT_ECONOMICS.md "Session H" for why these stay two
 * separate tables rather than one being overwritten by the other.
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

  const json = await request.json().catch(() => null);
  const parsed = jobActualsUpsertSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Enter valid, non-negative amounts.");

  const data = parsed.data;

  const actuals = await prisma.$transaction(async (tx) => {
    const saved = await tx.jobActuals.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
        actualMaterialCostMinor: data.actualMaterialCostMinor ?? null,
        actualCacMinor: data.actualCacMinor ?? null,
        actualOtherVariableCostMinor: data.actualOtherVariableCostMinor ?? null,
        note: data.note ?? null,
        recordedByAdminId: admin.id,
      },
      update: {
        actualMaterialCostMinor: data.actualMaterialCostMinor ?? null,
        actualCacMinor: data.actualCacMinor ?? null,
        actualOtherVariableCostMinor: data.actualOtherVariableCostMinor ?? null,
        note: data.note ?? null,
        recordedByAdminId: admin.id,
      },
    });
    await recordAuditEvent(
      {
        action: "JOB_ACTUALS_RECORDED",
        entityType: "JOB",
        entityId: id,
        actorId: admin.id,
        metadata: {
          actualMaterialCostMinor: saved.actualMaterialCostMinor,
          actualCacMinor: saved.actualCacMinor,
          actualOtherVariableCostMinor: saved.actualOtherVariableCostMinor,
        },
      },
      tx
    );
    return saved;
  });

  return adminApiOk({ id: actuals.id });
}
