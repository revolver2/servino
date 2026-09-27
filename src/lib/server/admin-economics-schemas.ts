import { z } from "zod";

/**
 * Post-job actual-cost capture (Session H, spec sections 38–40). Every
 * field is optional — an admin who doesn't know a number yet should be
 * able to save what they DO know without being forced to guess the
 * rest. `null`/absent means "unknown," never coerced to 0 by this
 * schema (see JobActuals' own nullable columns).
 */
const moneyMinorOrNull = z.number().int().finite().min(0).max(10_000_000).nullable().optional();

export const jobActualsUpsertSchema = z.object({
  actualMaterialCostMinor: moneyMinorOrNull,
  actualCacMinor: moneyMinorOrNull,
  actualOtherVariableCostMinor: moneyMinorOrNull,
  note: z.string().trim().max(1000).nullable().optional(),
});
