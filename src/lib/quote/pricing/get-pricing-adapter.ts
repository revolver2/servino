import type { PricingAdapter } from "./pricing-adapter";
import { MockPricingAdapter } from "./mock-pricing-adapter";
import { UnavailablePricingAdapter } from "./unavailable-pricing-adapter";

/**
 * Selects the pricing adapter. There is no real backend pricing engine
 * yet (Phase E), so:
 *
 * - Non-production builds always get the dev-only mock, so the funnel is
 *   testable.
 * - A production build only gets the mock if `NEXT_PUBLIC_USE_MOCK_PRICING`
 *   is explicitly set to "true" (e.g. a staging/demo deploy) — the default
 *   production behavior is to fail safe with UnavailablePricingAdapter
 *   rather than silently serve made-up prices to a real customer.
 */
export function getPricingAdapter(): PricingAdapter {
  const isProduction = process.env.NODE_ENV === "production";
  const mockExplicitlyEnabled = process.env.NEXT_PUBLIC_USE_MOCK_PRICING === "true";

  if (!isProduction || mockExplicitlyEnabled) {
    return new MockPricingAdapter();
  }

  return new UnavailablePricingAdapter();
}
