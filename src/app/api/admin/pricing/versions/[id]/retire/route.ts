import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Retires a DRAFT (abandoning it) or an ACTIVE version. Retiring the
 * currently active version with no replacement is a legitimate, if
 * unusual, admin action — the customer funnel fails closed to
 * "pricing unavailable" if no ACTIVE version exists (spec section 5/74),
 * it does not fall back to anything fabricated.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const version = await prisma.pricingVersion.findUnique({ where: { id } });
  if (!version) return adminApiError("NOT_FOUND", "Pricing version not found.");
  if (version.status === "RETIRED") {
    return adminApiError("INVALID_TRANSITION", "This version is already retired.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.pricingVersion.update({ where: { id }, data: { status: "RETIRED", retiredAt: new Date() } });
    await recordAuditEvent(
      {
        action: "PRICING_VERSION_RETIRED",
        entityType: "PRICING_VERSION",
        entityId: id,
        actorId: admin.id,
        metadata: { reason: "manual", previousStatus: version.status },
      },
      tx
    );
  });

  return adminApiOk({ id, status: "RETIRED" });
}
