import { z } from "zod";

/**
 * Explicit field whitelists for every professional-facing mutation (same
 * mass-assignment discipline as admin-schemas.ts, spec section 55).
 */

export const proLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export const proActivateSchema = z.object({
  token: z.string().trim().min(1).max(200),
  password: z.string().min(12).max(200),
});

export const declineReasonSchema = z.enum(["UNAVAILABLE", "TIMING", "OUTSIDE_AREA", "NOT_SUITABLE", "OTHER"]);

export const jobDeclineSchema = z.object({
  reason: declineReasonSchema.optional(),
  note: z.string().trim().max(500).optional(),
});

export const problemReasonSchema = z.enum([
  "CUSTOMER_UNAVAILABLE",
  "ACCESS_PROBLEM",
  "MATERIAL_PROBLEM",
  "SCOPE_DIFFERS",
  "SAFETY_CONCERN",
  "CANNOT_COMPLETE",
  "OTHER",
]);

export const jobProblemReportSchema = z.object({
  reasonCode: problemReasonSchema,
  note: z.string().trim().max(1000).optional(),
});
