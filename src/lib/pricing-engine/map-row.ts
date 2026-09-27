import type { Prisma } from "@prisma/client";
import type { PricingVersionForEngine, ServicePricingRuleForEngine } from "./types";

type PricingVersionRow = Prisma.PricingVersionGetPayload<{ include: { rules: true } }>;

/** Converts a Prisma PricingVersion row (with Decimal fields) into the plain-number engine shape. Shared by every pricing-version lookup so the mapping can never drift between call sites. */
export function mapPricingVersionRow(row: PricingVersionRow): {
  version: PricingVersionForEngine;
  rules: Map<string, ServicePricingRuleForEngine>;
} {
  const version: PricingVersionForEngine = {
    id: row.id,
    citySlug: row.citySlug,
    taxRatePercent: Number(row.taxRatePercent),
    taxLabel: row.taxLabel,
    professionalPayoutPercentOfLabor: Number(row.professionalPayoutPercentOfLabor),
    materialCostPercentOfCustomerRate: Number(row.materialCostPercentOfCustomerRate),
    paymentProcessingPercent: Number(row.paymentProcessingPercent),
    paymentProcessingFixedMinor: row.paymentProcessingFixedMinor,
    estimatedCacMinor: row.estimatedCacMinor,
    otherVariableCostMinor: row.otherVariableCostMinor,
    healthyMarginPercent: Number(row.healthyMarginPercent),
    acceptableMarginPercent: Number(row.acceptableMarginPercent),
    lowMarginPercent: Number(row.lowMarginPercent),
  };

  const rules = new Map<string, ServicePricingRuleForEngine>();
  for (const r of row.rules) {
    rules.set(r.serviceSlug, {
      serviceSlug: r.serviceSlug,
      installOnlyRateMinorPerM2: r.installOnlyRateMinorPerM2,
      materialRateMinorPerM2: r.materialRateMinorPerM2,
      minimumSubtotalMinor: r.minimumSubtotalMinor,
    });
  }

  return { version, rules };
}
