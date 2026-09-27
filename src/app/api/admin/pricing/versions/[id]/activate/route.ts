import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Activation is deliberate and one-directional: only a DRAFT version can
 * become ACTIVE (spec section 36 — no casually reactivating a RETIRED
 * version, which could silently resurrect stale assumptions). Activating
 * retires whatever was previously ACTIVE for the same city in the same
 * transaction; the database's own partial unique index
 * (`PricingVersion_one_active_per_city`, see docs/DECISIONS.md D027) is
 * the actual race-proof guarantee, not this application logic alone.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const version = await prisma.pricingVersion.findUnique({ where: { id }, include: { rules: true } });
  if (!version) return adminApiError("NOT_FOUND", "Pricing version not found.");
  if (version.status !== "DRAFT") {
    return adminApiError("INVALID_TRANSITION", "Only a draft version can be activated.");
  }
  if (version.rules.length === 0) {
    return adminApiError("VALIDATION_ERROR", "This version has no service rates configured.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const previouslyActive = await tx.pricingVersion.findFirst({
        where: { citySlug: version.citySlug, status: "ACTIVE" },
      });
      if (previouslyActive) {
        await tx.pricingVersion.update({
          where: { id: previouslyActive.id },
          data: { status: "RETIRED", retiredAt: new Date() },
        });
        await recordAuditEvent(
          {
            action: "PRICING_VERSION_RETIRED",
            entityType: "PRICING_VERSION",
            entityId: previouslyActive.id,
            actorId: admin.id,
            metadata: { reason: "superseded", supersededBy: id },
          },
          tx
        );
      }

      await tx.pricingVersion.update({
        where: { id },
        data: { status: "ACTIVE", activatedAt: new Date() },
      });
      await recordAuditEvent(
        {
          action: "PRICING_VERSION_ACTIVATED",
          entityType: "PRICING_VERSION",
          entityId: id,
          actorId: admin.id,
          metadata: { citySlug: version.citySlug, label: version.label },
        },
        tx
      );
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost a race to another concurrent activation for the same city —
      // the database's partial unique index is what actually enforced this.
      return adminApiError("CONFLICT", "Another version was activated for this city at the same time. Please retry.");
    }
    console.error("[api/admin/pricing/versions/activate] failed", err);
    return adminApiError("SERVER_ERROR", "Could not activate this pricing version.");
  }

  return adminApiOk({ id, status: "ACTIVE" });
}
