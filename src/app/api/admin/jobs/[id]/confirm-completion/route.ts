import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { adminCompletionConfirmSchema } from "@/lib/server/admin-payment-schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { maybeCreatePayoutEligibility } from "@/lib/server/payout-eligibility";

/**
 * Admin completion override (spec section 34) — for when a customer
 * doesn't respond. Requires an explicit reason, is fully audited, and
 * is always labeled "ADMIN CONFIRMED" in the UI, never "CUSTOMER
 * CONFIRMED" (never rewrites or erases the customer/professional
 * timeline, only adds to it).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = adminCompletionConfirmSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "A reason is required to confirm completion on the customer's behalf.");

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return adminApiError("NOT_FOUND", "Job not found.");

  const claimed = await prisma.job.updateMany({
    where: { id, status: "COMPLETED" },
    data: { status: "CONFIRMED" },
  });
  if (claimed.count === 0) {
    return adminApiError("CONFLICT", `Cannot confirm this job — it's currently ${job.status}.`);
  }

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(
      {
        action: "ADMIN_COMPLETION_CONFIRMED",
        entityType: "JOB",
        entityId: id,
        actorId: admin.id,
        metadata: { reason: parsed.data.reason },
      },
      tx
    );
    await maybeCreatePayoutEligibility(tx, id);
  });

  return adminApiOk({ id, status: "CONFIRMED" });
}
