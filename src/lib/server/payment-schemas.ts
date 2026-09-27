import { z } from "zod";
import { sessionIdSchema } from "./schemas";

/**
 * Customer-funnel payment schemas (Session G). `amountMinor` never
 * appears here — the amount is always derived server-side from the
 * job's `QuoteSnapshot`, never accepted from the client (spec section
 * 14). `testScenario` is only ever honored by the route handler when
 * `NODE_ENV !== "production"` (see `src/lib/payments/test-payment-provider.ts`) —
 * accepting it in the schema unconditionally is safe because a
 * production request that includes it is simply ignored downstream.
 */

export const paymentCreateOrderSchema = z.object({
  sessionId: sessionIdSchema,
  testScenario: z.enum(["SUCCESS", "DECLINE", "OUTAGE"]).optional(),
});

export const paymentCaptureOrderSchema = z.object({
  sessionId: sessionIdSchema,
  providerOrderId: z.string().min(1).max(200),
});

export const paymentStatusQuerySchema = z.object({
  sessionId: sessionIdSchema,
});
