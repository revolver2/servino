import type { MaterialOwnership } from "@/types/quote";

/** The subset of a PricingVersion row the engine needs — kept narrow so callers can pass a plain object in tests without a real Prisma row. */
export type PricingVersionForEngine = {
  id: string;
  citySlug: string;
  taxRatePercent: number;
  taxLabel: string;
  professionalPayoutPercentOfLabor: number;
  materialCostPercentOfCustomerRate: number;
  paymentProcessingPercent: number;
  paymentProcessingFixedMinor: number;
  estimatedCacMinor: number;
  otherVariableCostMinor: number;
  healthyMarginPercent: number;
  acceptableMarginPercent: number;
  lowMarginPercent: number;
};

export type ServicePricingRuleForEngine = {
  serviceSlug: string;
  installOnlyRateMinorPerM2: number;
  materialRateMinorPerM2: number;
  minimumSubtotalMinor: number;
};

export type CustomerPriceInput = {
  serviceSlug: string;
  serviceName: string;
  totalAreaM2: number;
  materialOwnership: MaterialOwnership;
};

export type CustomerPriceComputation = {
  /** Labor-only component of the subtotal, before any minimum-job floor is applied — used by the economics engine, never shown to the customer as a separate line. */
  laborComponentMinor: number;
  /** Material component of the subtotal (0 for INSTALL_ONLY), before any minimum-job floor. */
  materialComponentMinor: number;
  /** True if the minimum-job floor overrode the raw area-based calculation. */
  minimumApplied: boolean;
  subtotalMinor: number;
  taxMinor: number;
  taxLabel: string;
  totalMinor: number;
};

export type QuoteHealth = "HEALTHY" | "ACCEPTABLE" | "LOW_MARGIN" | "UNPROFITABLE";

export type EconomicsComputation = {
  professionalPayoutEstimateMinor: number;
  materialCostEstimateMinor: number;
  processingEstimateMinor: number;
  cacAssumptionMinor: number;
  discountMinor: number;
  referralCostMinor: number;
  otherVariableCostMinor: number;
  contributionProfitMinor: number;
  contributionMarginPercent: number;
  quoteHealth: QuoteHealth;
};
