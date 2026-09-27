/**
 * Payment provider boundary (Session G, spec sections 6/7).
 *
 * This is the ONLY way server code may talk to a payment processor.
 * Route handlers, webhook handlers, and admin reconciliation code must
 * never call a PayPal SDK or REST endpoint directly — they go through
 * this interface, the same way the quote funnel's `PricingAdapter`
 * (`src/lib/quote/pricing/pricing-adapter.ts`) is the only way to
 * obtain a price. `getPaymentProvider()` (`get-payment-provider.ts`)
 * selects the concrete implementation.
 *
 * Only PayPal is implemented (D039/D041) — no second provider this
 * session — but nothing here names PayPal, so a second provider could
 * be added later without touching call sites.
 */

/**
 * Only `TestPaymentProvider` reads this — a real `PayPalPaymentProvider`
 * call simply ignores the field. Carried on the shared input type (rather
 * than a per-provider extension) so call sites need no casting; see
 * `src/lib/payments/test-payment-provider.ts` for what each value does.
 */
export type TestScenario = "SUCCESS" | "DECLINE" | "OUTAGE";

export type CreateOrderInput = {
  /** Integer minor units (cents), server-derived — never client-supplied. */
  amountMinor: number;
  currency: "CAD";
  /** Servino's own Payment.id — becomes the provider order's custom/reference id, for reconciliation. */
  referenceId: string;
  /** Passed as the provider's own idempotency header — a retried call with the same key must not create a second order. */
  idempotencyKey: string;
  testScenario?: TestScenario;
};

export type CreateOrderResult =
  | { ok: true; providerOrderId: string; status: string }
  | { ok: false; reason: string };

export type CaptureOrderInput = {
  providerOrderId: string;
  idempotencyKey: string;
};

export type CaptureOrderResult =
  | {
      ok: true;
      providerCaptureId: string;
      status: "COMPLETED" | "PENDING" | "DECLINED";
      amountMinor: number;
      currency: string;
    }
  | { ok: false; reason: string };

export type GetOrderResult =
  | {
      ok: true;
      providerOrderId: string;
      status: string;
      providerCaptureId?: string;
      amountMinor?: number;
      currency?: string;
    }
  | { ok: false; reason: string };

export type RefundInput = {
  providerCaptureId: string;
  /** Omit for a full refund of the captured amount. */
  amountMinor?: number;
  currency: "CAD";
  idempotencyKey: string;
};

export type RefundResult =
  | { ok: true; providerRefundId: string; status: string }
  | { ok: false; reason: string };

/**
 * A webhook event, normalized away from PayPal's own payload shape so
 * the webhook route and reconciliation code never parse raw provider
 * JSON themselves (spec section 75 — minimize/redact what's persisted).
 */
export type NormalizedProviderEvent = {
  providerEventId: string;
  eventType: string;
  providerOrderId?: string;
  providerCaptureId?: string;
  status?: string;
  amountMinor?: number;
  currency?: string;
  /** Minimal, non-sensitive fields only — safe to persist as PaymentEvent.summary. */
  summary: Record<string, unknown>;
};

export type VerifyWebhookInput = {
  headers: Record<string, string>;
  rawBody: string;
};

export type VerifyWebhookResult =
  | { valid: true; event: NormalizedProviderEvent }
  | { valid: false; reason: string };

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  captureOrder(input: CaptureOrderInput): Promise<CaptureOrderResult>;
  getOrder(providerOrderId: string): Promise<GetOrderResult>;
  refundPayment(input: RefundInput): Promise<RefundResult>;
  /** Rejects anything that isn't a genuinely provider-signed event — never trust an unverified payload (spec section 21). */
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
