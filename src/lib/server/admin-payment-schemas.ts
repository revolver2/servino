import { z } from "zod";

/**
 * Admin-facing financial-mutation schemas (Session G) — same explicit
 * field-whitelist discipline as admin-schemas.ts/admin-pricing-schemas.ts
 * (spec section 45). No amount field is ever accepted for a refund
 * beyond a mode flag — Session G only supports a full refund (spec
 * section 50), so there is nothing to whitelist there.
 */

const moneyMinor = z.number().int().finite().min(0).max(10_000_000);

export const adminCompletionConfirmSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const refundCreateSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const payoutMethodCategorySchema = z.enum(["E_TRANSFER", "CASH", "CHEQUE", "DIRECT_DEPOSIT", "OTHER"]);

export const payoutRecordSchema = z
  .object({
    amountMinor: moneyMinor,
    methodCategory: payoutMethodCategorySchema,
    externalReference: z.string().trim().max(200).optional(),
    note: z.string().trim().max(1000).optional(),
    amountOverrideReason: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.amountMinor >= 0, { message: "Amount must not be negative." });

export const payoutHoldSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
