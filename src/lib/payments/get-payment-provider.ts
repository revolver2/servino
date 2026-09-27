import type { PaymentProvider } from "./payment-provider";
import { TestPaymentProvider } from "./test-payment-provider";
import { PayPalPaymentProvider } from "./paypal-payment-provider";
import { UnavailablePaymentProvider } from "./unavailable-payment-provider";

/**
 * Selects the payment provider (spec sections 61/62). Unlike
 * `getPricingAdapter()` (which allows an explicit opt-in mock in a
 * production build), payments have no such escape hatch — real money
 * only ever moves through `PayPalPaymentProvider`, and only when fully
 * configured.
 *
 * - Any non-production build (`NODE_ENV !== "production"`, which
 *   covers `next dev` and the Playwright `test-server.mjs` target)
 *   always gets `TestPaymentProvider` — deterministic, network-free,
 *   never capable of charging a real card regardless of what a request
 *   sends it (spec section 61).
 * - A production build gets `PayPalPaymentProvider` only if
 *   `PAYPAL_ENV`/`PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`/
 *   `PAYPAL_WEBHOOK_ID` are all present; otherwise it fails closed with
 *   `UnavailablePaymentProvider` rather than silently using the test
 *   double against real customers.
 *
 * Sandbox verification against the real PayPal sandbox (when
 * credentials are available) is done via a separate, explicitly-run
 * script that constructs `PayPalPaymentProvider` directly — see
 * docs/PAYMENTS.md "Sandbox verification" — never through this
 * automatic selection, so `next dev` can never accidentally reach a
 * real PayPal endpoint.
 */
export function getPaymentProvider(): PaymentProvider {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return new TestPaymentProvider();
  }

  const env = process.env.PAYPAL_ENV;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if ((env !== "sandbox" && env !== "live") || !clientId || !clientSecret || !webhookId) {
    return new UnavailablePaymentProvider();
  }

  return new PayPalPaymentProvider({ env, clientId, clientSecret, webhookId });
}
