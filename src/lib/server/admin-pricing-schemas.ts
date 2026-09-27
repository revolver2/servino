import { z } from "zod";

/**
 * Explicit safe bounds for every pricing field (spec section 47) — server
 * validation, not just UI hints. Money fields are integer minor units
 * (cents); percentages are plain numbers (13 = 13%). Bounds are generous
 * enough to never legitimately bind for this niche, tight enough to reject
 * fat-fingered or malicious extreme/negative/non-finite values.
 */
const moneyMinor = z.number().int().finite().min(0).max(10_000_000); // up to $100,000 — generous for a per-m² rate or a minimum charge
const percent = z.number().finite().min(0).max(100);

export const servicePricingRuleInputSchema = z.object({
  serviceSlug: z.string().min(1).max(100),
  installOnlyRateMinorPerM2: moneyMinor,
  materialRateMinorPerM2: moneyMinor,
  minimumSubtotalMinor: moneyMinor,
});

export const pricingVersionCreateSchema = z
  .object({
    citySlug: z.string().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    taxRatePercent: percent,
    taxLabel: z.string().trim().min(1).max(100),
    professionalPayoutPercentOfLabor: percent,
    materialCostPercentOfCustomerRate: percent,
    paymentProcessingPercent: percent,
    paymentProcessingFixedMinor: moneyMinor,
    estimatedCacMinor: moneyMinor,
    otherVariableCostMinor: moneyMinor,
    healthyMarginPercent: percent,
    acceptableMarginPercent: percent,
    lowMarginPercent: percent,
    notes: z.string().trim().max(2000).optional().nullable(),
    rules: z.array(servicePricingRuleInputSchema).min(1).max(50),
  })
  .refine((data) => data.healthyMarginPercent >= data.acceptableMarginPercent, {
    message: "Healthy threshold must be greater than or equal to the acceptable threshold.",
    path: ["healthyMarginPercent"],
  })
  .refine((data) => data.acceptableMarginPercent >= data.lowMarginPercent, {
    message: "Acceptable threshold must be greater than or equal to the low-margin threshold.",
    path: ["acceptableMarginPercent"],
  })
  .refine(
    (data) => new Set(data.rules.map((r) => r.serviceSlug)).size === data.rules.length,
    { message: "Duplicate service in rules.", path: ["rules"] }
  );

export const simulatePricingSchema = z.object({
  pricingVersionId: z.string().min(1).max(100),
  serviceSlug: z.string().min(1).max(100),
  totalAreaM2: z.number().finite().positive().max(9999),
  materialOwnership: z.enum(["INSTALL_ONLY", "MATERIAL_AND_INSTALL"]),
});
