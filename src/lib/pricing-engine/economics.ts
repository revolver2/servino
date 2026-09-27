import type {
  CustomerPriceComputation,
  EconomicsComputation,
  PricingVersionForEngine,
  QuoteHealth,
} from "./types";
import type { MaterialOwnership } from "@/types/quote";
import { applyPercent, roundMinor, roundPercent } from "./rounding";

/**
 * Internal unit-economics computation (spec sections 26/27/28) — never
 * called from anything customer-facing. Same engine backs both the real
 * quote flow and the admin simulator (spec section 37/82).
 *
 * Contribution profit = customer subtotal (tax excluded — tax is a
 * pass-through, not Servino's money) − professional payout estimate −
 * material cost estimate − processing estimate − CAC assumption − discount
 * − referral cost − other variable cost.
 */
export function computeEconomics(
  pricingVersion: PricingVersionForEngine,
  customerPrice: CustomerPriceComputation,
  materialOwnership: MaterialOwnership,
  overrides?: { discountMinor?: number; referralCostMinor?: number }
): EconomicsComputation {
  const professionalPayoutEstimateMinor = applyPercent(
    customerPrice.laborComponentMinor,
    pricingVersion.professionalPayoutPercentOfLabor
  );

  // No material cost exists when the customer already owns the material.
  const materialCostEstimateMinor =
    materialOwnership === "MATERIAL_AND_INSTALL"
      ? applyPercent(customerPrice.materialComponentMinor, pricingVersion.materialCostPercentOfCustomerRate)
      : 0;

  // Processing applies to what a card would actually be charged — the
  // tax-inclusive total, not the pre-tax subtotal.
  const processingEstimateMinor =
    applyPercent(customerPrice.totalMinor, pricingVersion.paymentProcessingPercent) +
    pricingVersion.paymentProcessingFixedMinor;

  const cacAssumptionMinor = pricingVersion.estimatedCacMinor;
  const otherVariableCostMinor = pricingVersion.otherVariableCostMinor;
  const discountMinor = overrides?.discountMinor ?? 0;
  const referralCostMinor = overrides?.referralCostMinor ?? 0;

  const contributionProfitMinor = roundMinor(
    customerPrice.subtotalMinor -
      professionalPayoutEstimateMinor -
      materialCostEstimateMinor -
      processingEstimateMinor -
      cacAssumptionMinor -
      otherVariableCostMinor -
      discountMinor -
      referralCostMinor
  );

  const contributionMarginPercent =
    customerPrice.subtotalMinor > 0
      ? roundPercent((contributionProfitMinor / customerPrice.subtotalMinor) * 100)
      : 0;

  const quoteHealth = classifyQuoteHealth(contributionMarginPercent, pricingVersion);

  return {
    professionalPayoutEstimateMinor,
    materialCostEstimateMinor,
    processingEstimateMinor,
    cacAssumptionMinor,
    discountMinor,
    referralCostMinor,
    otherVariableCostMinor,
    contributionProfitMinor,
    contributionMarginPercent,
    quoteHealth,
  };
}

function classifyQuoteHealth(marginPercent: number, pricingVersion: PricingVersionForEngine): QuoteHealth {
  if (marginPercent >= pricingVersion.healthyMarginPercent) return "HEALTHY";
  if (marginPercent >= pricingVersion.acceptableMarginPercent) return "ACCEPTABLE";
  if (marginPercent >= pricingVersion.lowMarginPercent) return "LOW_MARGIN";
  return "UNPROFITABLE";
}
