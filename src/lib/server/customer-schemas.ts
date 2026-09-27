import { z } from "zod";

/**
 * Schemas for the token-authenticated customer routes (Session G) — the
 * completion-confirmation link an admin delivers manually, mirroring
 * `pro-schemas.ts`'s `proActivateSchema` token shape.
 */

export const confirmationTokenSchema = z.object({
  token: z.string().trim().min(1).max(200),
});

export const customerIssueReasonSchema = z.enum(["INCOMPLETE", "QUALITY", "DAMAGE", "SCOPE", "OTHER"]);

export const customerIssueReportSchema = z.object({
  token: z.string().trim().min(1).max(200),
  reasonCode: customerIssueReasonSchema,
  note: z.string().trim().max(1000).optional(),
});
