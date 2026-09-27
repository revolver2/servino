import type {
  CaptureOrderInput,
  CaptureOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  GetOrderResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./payment-provider";

const REASON = "PAYMENTS_NOT_CONFIGURED";

/**
 * Fail-closed provider (spec section 62) — selected by
 * `getPaymentProvider()` whenever a production build is missing PayPal
 * configuration. Every method fails predictably rather than throwing an
 * unhandled exception or, worse, silently falling back to
 * `TestPaymentProvider` and fabricating a successful payment for a real
 * customer. Mirrors `UnavailablePricingAdapter`'s role for pricing.
 */
export class UnavailablePaymentProvider implements PaymentProvider {
  async createOrder(_input: CreateOrderInput): Promise<CreateOrderResult> {
    return { ok: false, reason: REASON };
  }

  async captureOrder(_input: CaptureOrderInput): Promise<CaptureOrderResult> {
    return { ok: false, reason: REASON };
  }

  async getOrder(_providerOrderId: string): Promise<GetOrderResult> {
    return { ok: false, reason: REASON };
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    return { ok: false, reason: REASON };
  }

  async verifyWebhook(_input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    return { valid: false, reason: REASON };
  }
}
