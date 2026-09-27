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
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./payment-provider";

export type PayPalConfig = {
  env: "sandbox" | "live";
  clientId: string;
  clientSecret: string;
  webhookId: string;
};

/**
 * Real PayPal Orders v2 + Payments v2 + webhook-verification REST client
 * (docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md — standard PayPal
 * Checkout, not Multiparty/Payouts). `intent: CAPTURE` was chosen over
 * `AUTHORIZE` (no delayed-capture need for Session G's launch flow).
 *
 * Every mutating call passes a `PayPal-Request-Id` idempotency header
 * (docs/PAYMENTS.md) — PayPal deduplicates repeats of the same header
 * value for the same call type for 45 days, so a network retry or
 * double-submit can never create two orders/captures/refunds.
 */
export class PayPalPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: PayPalConfig) {
    this.baseUrl = config.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }

    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new Error(`PayPal OAuth token request failed (${res.status})`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async request(
    path: string,
    init: { method: string; body?: unknown; idempotencyKey?: string }
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (init.idempotencyKey) headers["PayPal-Request-Id"] = init.idempotencyKey;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  private toDecimalString(amountMinor: number): string {
    return (amountMinor / 100).toFixed(2);
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    try {
      const { ok, json } = await this.request("/v2/checkout/orders", {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.referenceId,
              custom_id: input.referenceId,
              amount: { currency_code: input.currency, value: this.toDecimalString(input.amountMinor) },
            },
          ],
        },
      });

      if (!ok || !json || typeof json.id !== "string") {
        return { ok: false, reason: describeError(json) };
      }

      return { ok: true, providerOrderId: json.id, status: String(json.status ?? "CREATED") };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "UNKNOWN_ERROR" };
    }
  }

  async captureOrder(input: CaptureOrderInput): Promise<CaptureOrderResult> {
    try {
      const { ok, json } = await this.request(`/v2/checkout/orders/${input.providerOrderId}/capture`, {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
      });

      if (!json) return { ok: false, reason: "NO_RESPONSE_BODY" };

      const purchaseUnits = json.purchase_units as Array<Record<string, unknown>> | undefined;
      const captures = purchaseUnits?.[0]?.payments as Record<string, unknown> | undefined;
      const capture = (captures?.captures as Array<Record<string, unknown>> | undefined)?.[0];

      if (!ok || !capture || typeof capture.id !== "string") {
        return { ok: false, reason: describeError(json) };
      }

      const amount = capture.amount as Record<string, unknown> | undefined;
      const status = String(capture.status ?? "");
      const normalizedStatus: "COMPLETED" | "PENDING" | "DECLINED" =
        status === "COMPLETED" ? "COMPLETED" : status === "PENDING" ? "PENDING" : "DECLINED";

      return {
        ok: true,
        providerCaptureId: capture.id,
        status: normalizedStatus,
        amountMinor: amount?.value ? Math.round(parseFloat(String(amount.value)) * 100) : 0,
        currency: String(amount?.currency_code ?? "CAD"),
      };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "UNKNOWN_ERROR" };
    }
  }

  async getOrder(providerOrderId: string): Promise<GetOrderResult> {
    try {
      const { ok, json } = await this.request(`/v2/checkout/orders/${providerOrderId}`, { method: "GET" });
      if (!ok || !json || typeof json.id !== "string") {
        return { ok: false, reason: describeError(json) };
      }

      const purchaseUnits = json.purchase_units as Array<Record<string, unknown>> | undefined;
      const captures = purchaseUnits?.[0]?.payments as Record<string, unknown> | undefined;
      const capture = (captures?.captures as Array<Record<string, unknown>> | undefined)?.[0];
      const amount = capture?.amount as Record<string, unknown> | undefined;

      return {
        ok: true,
        providerOrderId: json.id,
        status: String(json.status ?? ""),
        providerCaptureId: typeof capture?.id === "string" ? capture.id : undefined,
        amountMinor: amount?.value ? Math.round(parseFloat(String(amount.value)) * 100) : undefined,
        currency: typeof amount?.currency_code === "string" ? amount.currency_code : undefined,
      };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "UNKNOWN_ERROR" };
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    try {
      const body = input.amountMinor
        ? { amount: { value: this.toDecimalString(input.amountMinor), currency_code: input.currency } }
        : undefined;

      const { ok, json } = await this.request(`/v2/payments/captures/${input.providerCaptureId}/refund`, {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body,
      });

      if (!ok || !json || typeof json.id !== "string") {
        return { ok: false, reason: describeError(json) };
      }

      return { ok: true, providerRefundId: json.id, status: String(json.status ?? "") };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "UNKNOWN_ERROR" };
    }
  }

  /**
   * Calls PayPal's own `/v1/notifications/verify-webhook-signature`
   * (docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md) rather than
   * re-implementing certificate validation locally — PayPal is the
   * authority on whether a delivery is genuinely theirs. A webhook is
   * never trusted, applied, or turned into a PaymentEvent without this
   * call returning SUCCESS first (spec section 21).
   */
  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const h = input.headers;
    const transmissionId = h["paypal-transmission-id"];
    const transmissionTime = h["paypal-transmission-time"];
    const certUrl = h["paypal-cert-url"];
    const authAlgo = h["paypal-auth-algo"];
    const transmissionSig = h["paypal-transmission-sig"];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return { valid: false, reason: "MISSING_VERIFICATION_HEADERS" };
    }

    let webhookEvent: Record<string, unknown>;
    try {
      webhookEvent = JSON.parse(input.rawBody);
    } catch {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }

    try {
      const { ok, json } = await this.request("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: {
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: this.config.webhookId,
          webhook_event: webhookEvent,
        },
      });

      if (!ok || !json || json.verification_status !== "SUCCESS") {
        return { valid: false, reason: "SIGNATURE_VERIFICATION_FAILED" };
      }
    } catch (err) {
      return { valid: false, reason: err instanceof Error ? err.message : "VERIFICATION_REQUEST_FAILED" };
    }

    const providerEventId = webhookEvent.id;
    const eventType = webhookEvent.event_type;
    if (typeof providerEventId !== "string" || typeof eventType !== "string") {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }

    const resource = (webhookEvent.resource ?? {}) as Record<string, unknown>;
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

function describeError(json: Record<string, unknown> | null): string {
  if (!json) return "NO_RESPONSE_BODY";
  if (typeof json.message === "string") return json.message;
  if (typeof json.name === "string") return json.name;
  return "PROVIDER_ERROR";
}
