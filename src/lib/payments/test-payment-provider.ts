import { createHmac, randomBytes } from "node:crypto";
import type {
  CaptureOrderInput,
  CaptureOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  GetOrderResult,
  NormalizedProviderEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  TestScenario,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./payment-provider";

/**
 * Shared secret for signing TEST webhook payloads in Playwright E2E tests
 * (see docs/PAYMENTS.md "Testing"). Not a real credential, never used by
 * `PayPalPaymentProvider`, and `getPaymentProvider()` never selects this
 * provider in production — so this constant being public in the repo is
 * not a secret leak.
 */
export const TEST_WEBHOOK_SECRET = "servino-test-webhook-secret-not-a-real-credential";

export function signTestWebhookPayload(rawBody: string): string {
  return createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

type TestOrderState = {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: "CREATED" | "COMPLETED" | "DECLINED";
  providerCaptureId?: string;
  scenario: TestScenario;
};

// Module-level, in-memory — lives for the process's lifetime (a single
// `next dev`/test-server process), reset on restart. Never wired into a
// production build (see get-payment-provider.ts's fail-closed gate), so
// this is not a durability concern.
const orders = new Map<string, TestOrderState>();
const createIdempotency = new Map<string, CreateOrderResult>();
const captureIdempotency = new Map<string, CaptureOrderResult>();

/**
 * Deterministic, network-free double for `PaymentProvider` (spec section
 * 61). Selected automatically for every non-production build
 * (`get-payment-provider.ts`) so the Playwright suite — and local dev —
 * never depend on, or accidentally charge, a real PayPal account.
 *
 * Test-controlled scenarios: callers may pass an optional
 * `testScenario` on `createOrder`'s input ("SUCCESS" default, "DECLINE"
 * simulates a real-world card decline surfaced only at capture time,
 * "OUTAGE" simulates the provider being unreachable). The checkout API
 * route only ever reads this field from the request body when
 * `NODE_ENV !== "production"` — a production build ignores it
 * unconditionally, so it is not a client-tamperable financial
 * parameter in any environment that processes real money.
 */
export class TestPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const cacheKey = `create:${input.idempotencyKey}`;
    const cached = createIdempotency.get(cacheKey);
    if (cached) return cached;

    const scenario = input.testScenario ?? "SUCCESS";

    if (scenario === "OUTAGE") {
      const result: CreateOrderResult = { ok: false, reason: "TEST_PROVIDER_OUTAGE" };
      createIdempotency.set(cacheKey, result);
      return result;
    }

    const providerOrderId = `TEST-ORDER-${randomBytes(8).toString("hex")}`;
    orders.set(providerOrderId, {
      providerOrderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "CREATED",
      scenario,
    });

    const result: CreateOrderResult = { ok: true, providerOrderId, status: "CREATED" };
    createIdempotency.set(cacheKey, result);
    return result;
  }

  async captureOrder(input: CaptureOrderInput): Promise<CaptureOrderResult> {
    const cacheKey = `capture:${input.idempotencyKey}`;
    const cached = captureIdempotency.get(cacheKey);
    if (cached) return cached;

    const order = orders.get(input.providerOrderId);
    if (!order) {
      const result: CaptureOrderResult = { ok: false, reason: "ORDER_NOT_FOUND" };
      captureIdempotency.set(cacheKey, result);
      return result;
    }

    if (order.scenario === "OUTAGE") {
      const result: CaptureOrderResult = { ok: false, reason: "TEST_PROVIDER_OUTAGE" };
      captureIdempotency.set(cacheKey, result);
      return result;
    }

    if (order.scenario === "DECLINE") {
      order.status = "DECLINED";
      const result: CaptureOrderResult = {
        ok: true,
        providerCaptureId: `TEST-CAPTURE-${randomBytes(8).toString("hex")}`,
        status: "DECLINED",
        amountMinor: order.amountMinor,
        currency: order.currency,
      };
      captureIdempotency.set(cacheKey, result);
      return result;
    }

    // Re-capturing an already-completed order (a second create-order
    // idempotency-key collision, or a genuine repeat capture call)
    // returns the SAME capture id rather than minting a new one.
    if (order.status === "COMPLETED" && order.providerCaptureId) {
      const result: CaptureOrderResult = {
        ok: true,
        providerCaptureId: order.providerCaptureId,
        status: "COMPLETED",
        amountMinor: order.amountMinor,
        currency: order.currency,
      };
      captureIdempotency.set(cacheKey, result);
      return result;
    }

    const providerCaptureId = `TEST-CAPTURE-${randomBytes(8).toString("hex")}`;
    order.status = "COMPLETED";
    order.providerCaptureId = providerCaptureId;

    const result: CaptureOrderResult = {
      ok: true,
      providerCaptureId,
      status: "COMPLETED",
      amountMinor: order.amountMinor,
      currency: order.currency,
    };
    captureIdempotency.set(cacheKey, result);
    return result;
  }

  async getOrder(providerOrderId: string): Promise<GetOrderResult> {
    const order = orders.get(providerOrderId);
    if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };
    return {
      ok: true,
      providerOrderId: order.providerOrderId,
      status: order.status,
      providerCaptureId: order.providerCaptureId,
      amountMinor: order.amountMinor,
      currency: order.currency,
    };
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    return {
      ok: true,
      providerRefundId: `TEST-REFUND-${randomBytes(8).toString("hex")}`,
      status: "COMPLETED",
    };
  }

  /**
   * Verifies an HMAC-SHA256 signature over the raw body using
   * `TEST_WEBHOOK_SECRET`, via the `x-test-signature` header — the test
   * double's stand-in for PayPal's own
   * `/v1/notifications/verify-webhook-signature` call. Rejects a
   * missing/incorrect signature and a malformed body exactly like
   * `PayPalPaymentProvider` rejects an unverifiable or malformed real
   * webhook (spec section 21) — this is what makes the webhook security
   * tests meaningful against the test double, not just the shape of a
   * happy path.
   */
  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const signature = input.headers["x-test-signature"];
    if (!signature) return { valid: false, reason: "MISSING_SIGNATURE" };

    const expected = signTestWebhookPayload(input.rawBody);
    if (signature !== expected) return { valid: false, reason: "INVALID_SIGNATURE" };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }

    const providerEventId = parsed.id;
    const eventType = parsed.event_type;
    if (typeof providerEventId !== "string" || typeof eventType !== "string") {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }

    const resource = (parsed.resource ?? {}) as Record<string, unknown>;
    const amount = (resource.amount ?? {}) as Record<string, unknown>;
    const relatedIds = ((resource.supplementary_data as Record<string, unknown> | undefined)?.related_ids ??
      {}) as Record<string, unknown>;

    const event: NormalizedProviderEvent = {
      providerEventId,
      eventType,
      providerOrderId: typeof relatedIds.order_id === "string" ? relatedIds.order_id : undefined,
      providerCaptureId: typeof resource.id === "string" ? resource.id : undefined,
      status: typeof resource.status === "string" ? resource.status : undefined,
      amountMinor: typeof amount.value === "string" ? Math.round(parseFloat(amount.value) * 100) : undefined,
      currency: typeof amount.currency_code === "string" ? amount.currency_code : undefined,
      summary: { event_type: eventType, resource_status: resource.status ?? null },
    };

    return { valid: true, event };
  }
}
