import type { PriceResult } from "@/types/quote";
import type { CustomerPriceInput, EconomicsComputation } from "./types";
import { getActivePricingVersion } from "./active-version";
import { computeCustomerPrice } from "./customer-price";
import { computeEconomics } from "./economics";
import { MockPricingAdapter } from "@/lib/quote/pricing/mock-pricing-adapter";

export type PricingResolution =
  | {
      source: "AUTHORITATIVE_VERSIONED";
      price: PriceResult;
      pricingVersionId: string;
      economics: EconomicsComputation;
    }
  | { source: "MOCK_DEV"; price: PriceResult }
  | { source: "UNAVAILABLE"; price: PriceResult };

/**
 * The single server-side entry point for real pricing (spec sections 5/9)
 * — `/api/lead/price` and nothing else calls this for a production quote.
 * Selection policy (see docs/DECISIONS.md D026):
 *
 *   - Production: ALWAYS the authoritative versioned engine. If no ACTIVE
 *     PricingVersion exists for the city, fails closed to UNAVAILABLE —
 *     never mock, regardless of any environment flag.
 *   - Non-production with NEXT_PUBLIC_USE_MOCK_PRICING=true: always mock
 *     (fast UI iteration without seeding a pricing version).
 *   - Non-production otherwise: prefers the real versioned engine if one
 *     has been configured (so dev/test can exercise real pricing), falls
 *     back to mock if not (preserves the pre-Session-E dev experience).
 */
export async function resolvePricing(input: CustomerPriceInput & { citySlug: string }): Promise<PricingResolution> {
  const isProduction = process.env.NODE_ENV === "production";
  const forceMock = process.env.NEXT_PUBLIC_USE_MOCK_PRICING === "true";

  if (!isProduction && forceMock) {
    return { source: "MOCK_DEV", price: await new MockPricingAdapter().calculate(input) };
  }

  const active = await getActivePricingVersion(input.citySlug);
  const rule = active?.rules.get(input.serviceSlug);

  if (active && rule) {
    const customerPrice = computeCustomerPrice(active.version, rule, input);
    const economics = computeEconomics(active.version, customerPrice, input.materialOwnership);

    const price: PriceResult = {
      status: "ok",
      currency: "CAD",
      serviceSlug: input.serviceSlug,
      serviceName: input.serviceName,
      totalAreaM2: input.totalAreaM2,
      materialOwnership: input.materialOwnership,
      subtotalMinor: customerPrice.subtotalMinor,
      taxMinor: customerPrice.taxMinor,
      taxLabel: customerPrice.taxLabel,
      totalMinor: customerPrice.totalMinor,
      pricingSource: "authoritative-versioned",
      generatedAt: new Date().toISOString(),
    };

    return { source: "AUTHORITATIVE_VERSIONED", price, pricingVersionId: active.version.id, economics };
  }

  if (!isProduction) {
    return { source: "MOCK_DEV", price: await new MockPricingAdapter().calculate(input) };
  }

  return {
    source: "UNAVAILABLE",
    price: {
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
    },
  };
}
