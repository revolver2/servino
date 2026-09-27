import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { furthestStatus } from "@/lib/server/lead-status";
import { priceSchema } from "@/lib/server/schemas";
import { getEnabledServices } from "@/lib/services-data";
import { resolvePricing } from "@/lib/pricing-engine/resolve-pricing";

/**
 * CRITICAL trust boundary (spec section 6): this endpoint takes only a
 * session ID. It never accepts a price, subtotal, or total from the
 * client — it loads the lead's already-persisted, already-validated
 * inputs (service, area, material ownership) from the database and
 * recomputes the price itself via `resolvePricing()`, the one place a
 * real price is ever computed server-side. The resulting `QuoteSnapshot`
 * — not anything the browser displayed — is what's authoritative.
 *
 * Session E: `pricingSource`/`pricingVersionId` are now written from the
 * ACTUAL resolution result, not hardcoded — see docs/DECISIONS.md D026
 * for why a pre-existing "always MOCK_DEV" bug here was safe until now
 * (no other source ever existed) but needed fixing before a second real
 * source could exist. When resolution used the authoritative versioned
 * engine, an internal `EconomicsSnapshot` is also created, paired 1:1
 * with the `QuoteSnapshot` — never exposed to the customer response.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-price", ip, { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const json = await request.json().catch(() => null);
  const parsed = priceSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.", parsed.error.flatten());

  const lead = await prisma.lead.findUnique({ where: { sessionId: parsed.data.sessionId } });
  if (!lead || !lead.serviceSlug || !lead.citySlug || !lead.totalAreaM2 || !lead.materialOwnership) {
    return apiError("INVALID_FUNNEL_STATE", "Project details are incomplete.");
  }

  const service = getEnabledServices().find((s) => s.slug === lead.serviceSlug);
  if (!service) return apiError("VALIDATION_ERROR", "Unknown service.");

  const resolution = await resolvePricing({
    citySlug: lead.citySlug,
    serviceSlug: lead.serviceSlug,
    serviceName: service.name,
    totalAreaM2: Number(lead.totalAreaM2),
    materialOwnership: lead.materialOwnership,
  });

  const result = resolution.price;
  if (result.status !== "ok") {
    return apiError("PRICING_UNAVAILABLE", result.unavailableReason ?? "Pricing is temporarily unavailable.");
  }

  const pricingSourceForDb = resolution.source === "AUTHORITATIVE_VERSIONED" ? "AUTHORITATIVE_VERSIONED" : "MOCK_DEV";

  try {
    const snapshot = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteSnapshot.create({
        data: {
          leadId: lead.id,
          serviceSlug: result.serviceSlug,
          serviceName: result.serviceName,
          totalAreaM2: result.totalAreaM2,
          materialOwnership: result.materialOwnership,
          currency: result.currency,
          subtotalMinor: result.subtotalMinor,
          taxMinor: result.taxMinor,
          taxLabel: result.taxLabel,
          totalMinor: result.totalMinor,
          pricingSource: pricingSourceForDb,
          priceGeneratedAt: new Date(result.generatedAt),
          pricingVersionId: resolution.source === "AUTHORITATIVE_VERSIONED" ? resolution.pricingVersionId : null,
        },
      });

      if (resolution.source === "AUTHORITATIVE_VERSIONED") {
        const e = resolution.economics;
        await tx.economicsSnapshot.create({
          data: {
            quoteSnapshotId: created.id,
            pricingVersionId: resolution.pricingVersionId,
            professionalPayoutEstimateMinor: e.professionalPayoutEstimateMinor,
            materialCostEstimateMinor: e.materialCostEstimateMinor,
            processingEstimateMinor: e.processingEstimateMinor,
            cacAssumptionMinor: e.cacAssumptionMinor,
            discountMinor: e.discountMinor,
            referralCostMinor: e.referralCostMinor,
            otherVariableCostMinor: e.otherVariableCostMinor,
            contributionProfitMinor: e.contributionProfitMinor,
            contributionMarginPercent: e.contributionMarginPercent,
            quoteHealth: e.quoteHealth,
          },
        });
      }

      return created;
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: furthestStatus(lead.status, "PRICE_VIEWED") },
    });

    return apiOk({ snapshotId: snapshot.id, price: result });
  } catch (err) {
    console.error("[api/lead/price] failed", err);
    return apiError("LEAD_SAVE_FAILED", "Could not save your price. Please try again.");
  }
}
