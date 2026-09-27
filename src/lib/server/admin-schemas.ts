import { z } from "zod";

/**
 * Explicit field whitelists for every admin mutation (spec section 45 —
 * mass assignment). A client can never inject internal IDs, audit actor,
 * timestamps, or role escalation through these — only the fields listed
 * here are ever read from a request body.
 */

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

const phoneRegex = /^[0-9+()\-.\s]+$/;

export const professionalVerificationStatusSchema = z.enum([
  "MISSING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
]);

export const professionalCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  businessName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(20).regex(phoneRegex, "Invalid phone number"),
  serviceAreaNote: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  verificationStatus: professionalVerificationStatusSchema.optional(),
  serviceSlugs: z.array(z.string().max(100)).max(20).optional(),
});

export const professionalUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  businessName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(7).max(20).regex(phoneRegex, "Invalid phone number").optional(),
  serviceAreaNote: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  verificationStatus: professionalVerificationStatusSchema.optional(),
  active: z.boolean().optional(),
  serviceSlugs: z.array(z.string().max(100)).max(20).optional(),
});

export const jobStatusSchema = z.enum([
  "NEW",
  "REVIEWING",
  "READY_FOR_ASSIGNMENT",
  "OFFERED",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CONFIRMED",
  "CANCELLED",
  "DISPUTED",
  "MANUAL_REVIEW",
]);

export const jobStatusChangeSchema = z.object({
  status: jobStatusSchema,
});

export const jobAssignSchema = z.object({
  professionalId: z.string().trim().min(1).max(100),
});

// Session F — same safe-bounds discipline as Session E's pricing money
// fields (spec section 20): integer cents, finite, non-negative, capped.
export const jobOfferCreateSchema = z.object({
  professionalId: z.string().trim().min(1).max(100),
  offerAmountMinor: z.number().int().finite().min(0).max(10_000_000),
});

export const adminNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const leadListQuerySchema = z.object({
  status: z.string().max(50).optional(),
  service: z.string().max(100).optional(),
  source: z.string().max(200).optional(),
  bookingIntent: z.enum(["yes", "no"]).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const jobListQuerySchema = z.object({
  status: z.string().max(50).optional(),
  service: z.string().max(100).optional(),
  assigned: z.enum(["yes", "no"]).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});
