import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { pricingVersionCreateSchema } from "@/lib/server/admin-pricing-schemas";
import { getEnabledServices } from "@/lib/services-data";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Creates a new PricingVersion in DRAFT status with its service rate rules
 * (spec section 36: DRAFT → REVIEW → ACTIVATE — activation is a separate,
 * deliberate step via /activate, never implicit at creation).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const json = await request.json().catch(() => null);
  const parsed = pricingVersionCreateSchema.safeParse(json);
  if (!parsed.success) {
    return adminApiError("VALIDATION_ERROR", "Check the pricing details and try again.", parsed.error.flatten());
  }
  const data = parsed.data;

  const validSlugs = new Set(getEnabledServices().map((s) => s.slug));
  const unknownSlug = data.rules.find((r) => !validSlugs.has(r.serviceSlug));
  if (unknownSlug) {
    return adminApiError("VALIDATION_ERROR", `Unknown service: ${unknownSlug.serviceSlug}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.pricingVersion.create({
      data: {
        citySlug: data.citySlug,
        label: data.label,
        status: "DRAFT",
        taxRatePercent: data.taxRatePercent,
        taxLabel: data.taxLabel,
        professionalPayoutPercentOfLabor: data.professionalPayoutPercentOfLabor,
        materialCostPercentOfCustomerRate: data.materialCostPercentOfCustomerRate,
        paymentProcessingPercent: data.paymentProcessingPercent,
        paymentProcessingFixedMinor: data.paymentProcessingFixedMinor,
        estimatedCacMinor: data.estimatedCacMinor,
        otherVariableCostMinor: data.otherVariableCostMinor,
        healthyMarginPercent: data.healthyMarginPercent,
        acceptableMarginPercent: data.acceptableMarginPercent,
        lowMarginPercent: data.lowMarginPercent,
        notes: data.notes ?? null,
        createdByAdminId: admin.id,
        rules: {
          create: data.rules.map((r) => ({
            serviceSlug: r.serviceSlug,
            installOnlyRateMinorPerM2: r.installOnlyRateMinorPerM2,
            materialRateMinorPerM2: r.materialRateMinorPerM2,
            minimumSubtotalMinor: r.minimumSubtotalMinor,
          })),
        },
      },
    });

    await recordAuditEvent(
      {
        action: "PRICING_VERSION_CREATED",
        entityType: "PRICING_VERSION",
        entityId: version.id,
        actorId: admin.id,
        metadata: { label: version.label, citySlug: version.citySlug },
      },
      tx
    );

    return version;
  });

  return adminApiOk({ id: created.id }, 201);
}
