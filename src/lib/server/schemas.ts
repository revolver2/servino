import { z } from "zod";

export const sessionIdSchema = z.string().min(10).max(200);

export const attributionSchema = z.object({
  utmSource: z.string().max(200).nullable(),
  utmMedium: z.string().max(200).nullable(),
  utmCampaign: z.string().max(200).nullable(),
  utmContent: z.string().max(200).nullable(),
  utmTerm: z.string().max(200).nullable(),
  landingRoute: z.string().max(500),
  referrer: z.string().max(500).nullable(),
  firstTouchAt: z.string(),
});

export const funnelStepSchema = z.enum([
  "PROJECT",
  "MEASUREMENTS",
  "PHOTO",
  "STYLE",
  "PRICE",
  "CONTACT",
  "TIMING",
  "PAYMENT",
  "CONFIRMATION",
]);

export const progressSchema = z.object({
  sessionId: sessionIdSchema,
  attribution: attributionSchema.optional(),
  serviceSlug: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  measurementUnit: z.enum(["METRIC", "IMPERIAL"]).optional(),
  totalAreaM2: z.number().positive().max(9999).optional(),
  styleId: z.string().max(100).optional(),
  materialOwnership: z.enum(["INSTALL_ONLY", "MATERIAL_AND_INSTALL"]).optional(),
  currentStep: funnelStepSchema,
});

export const priceSchema = z.object({
  sessionId: sessionIdSchema,
});

export const contactSchema = z.object({
  sessionId: sessionIdSchema,
  firstName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[0-9+()\-.\s]+$/, "Invalid phone number"),
  honeypot: z.string().max(500).optional(),
  formRenderedAt: z.string().optional(),
});

export const timingSchema = z.object({
  sessionId: sessionIdSchema,
  value: z.enum(["ASAP", "WITHIN_2_WEEKS", "WITHIN_MONTH", "JUST_PLANNING"]),
});

export const bookingIntentSchema = z.object({
  sessionId: sessionIdSchema,
});
