import type { PriceResult } from "@/types/quote";
import type { PricingAdapter, QuoteInput } from "./pricing-adapter";
import {
  DEV_INSTALL_ONLY_RATE_PER_M2_MINOR,
  DEV_MATERIAL_RATE_PER_M2_MINOR,
  DEV_MINIMUM_SUBTOTAL_MINOR,
  DEV_ONTARIO_HST_LABEL,
  DEV_ONTARIO_HST_RATE,
} from "./dev-pricing-config";

/**
 * DEVELOPMENT-ONLY pricing implementation.
 *
 * Deterministic and isolated so it is impossible to mistake for a real
 * pricing engine: every field it reads comes from `dev-pricing-config.ts`,
 * which is itself labeled as non-authoritative. Used only when
 * `getPricingAdapter()` decides mock pricing is allowed (see
 * `get-pricing-adapter.ts`) — never silently in a real production build.
 */
export class MockPricingAdapter implements PricingAdapter {
  async calculate(input: QuoteInput): Promise<PriceResult> {
    const installRate = DEV_INSTALL_ONLY_RATE_PER_M2_MINOR[input.serviceSlug];
    const materialRate = DEV_MATERIAL_RATE_PER_M2_MINOR[input.serviceSlug];

    if (installRate == null || materialRate == null || input.totalAreaM2 <= 0) {
      return unavailable(input, "No development pricing configured for this input.");
    }

    const perM2Minor =
      input.materialOwnership === "MATERIAL_AND_INSTALL" ? installRate + materialRate : installRate;

    const rawSubtotal = Math.round(perM2Minor * input.totalAreaM2);
    const subtotalMinor = Math.max(rawSubtotal, DEV_MINIMUM_SUBTOTAL_MINOR);
    const taxMinor = Math.round(subtotalMinor * DEV_ONTARIO_HST_RATE);
    const totalMinor = subtotalMinor + taxMinor;

    return {
      status: "ok",
      currency: "CAD",
      serviceSlug: input.serviceSlug,
      serviceName: input.serviceName,
      totalAreaM2: input.totalAreaM2,
      materialOwnership: input.materialOwnership,
      subtotalMinor,
      taxMinor,
      taxLabel: DEV_ONTARIO_HST_LABEL,
      totalMinor,
      pricingSource: "mock-dev",
      generatedAt: new Date().toISOString(),
    };
  }
}

function unavailable(input: QuoteInput, reason: string): PriceResult {
  return {
    status: "unavailable",
    currency: "CAD",
    serviceSlug: input.serviceSlug,
    serviceName: input.serviceName,
    totalAreaM2: input.totalAreaM2,
    materialOwnership: input.materialOwnership,
    subtotalMinor: 0,
    taxMinor: 0,
    taxLabel: DEV_ONTARIO_HST_LABEL,
    totalMinor: 0,
    pricingSource: "unavailable",
    generatedAt: new Date().toISOString(),
    unavailableReason: reason,
  };
}
