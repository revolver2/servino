import type { PriceResult } from "@/types/quote";
import type { PricingAdapter, QuoteInput } from "./pricing-adapter";

/**
 * Fail-safe pricing adapter — returns a clearly "unavailable" result
 * instead of silently fabricating a price. `get-pricing-adapter.ts` (the
 * client-side/offline selection path) still falls back to this in
 * production; the real server-side price route's own fail-closed path
 * (`resolvePricing()`, when no ACTIVE PricingVersion exists) is separate
 * and does not use this class — see `docs/PRICING_MODEL.md`.
 */
export class UnavailablePricingAdapter implements PricingAdapter {
  async calculate(input: QuoteInput): Promise<PriceResult> {
    return {
      status: "unavailable",
      currency: "CAD",
      serviceSlug: input.serviceSlug,
      serviceName: input.serviceName,
      totalAreaM2: input.totalAreaM2,
      materialOwnership: input.materialOwnership,
      subtotalMinor: 0,
      taxMinor: 0,
      taxLabel: "",
      totalMinor: 0,
      pricingSource: "unavailable",
      generatedAt: new Date().toISOString(),
      unavailableReason: "Pricing is temporarily unavailable. Please try again shortly.",
    };
  }
}
