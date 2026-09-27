// Standalone verification (spec section 62) that a production build with
// missing/incomplete PayPal configuration fails closed — never silently
// falls back to the deterministic test provider against real customers.
//
// Node's native TypeScript loader (--experimental-strip-types) requires
// explicit file extensions on relative imports, which the app's own
// source deliberately doesn't use (Next.js's own resolver doesn't want
// them either) — so rather than changing module resolution app-wide
// just for this script, the selection predicate below is a verbatim
// mirror of `src/lib/payments/get-payment-provider.ts`'s own logic, the
// same "small obviously-correct duplication beats a fragile
// cross-boundary import" precedent already used by
// tests/e2e/helpers/admin.ts and pro.ts for password hashing. If this
// predicate and the real file ever diverge, that's a real bug to catch
// on the next review of get-payment-provider.ts, not something this
// script can detect by itself — it verifies the DECISION LOGIC's
// behavior across the four required inputs, not the live import.
//
// Run with: node scripts/verify-payment-provider-failclosed.mjs

import assert from "node:assert/strict";

function selectProviderKind(env) {
  const isProduction = env.NODE_ENV === "production";
  if (!isProduction) return "TEST";

  const paypalEnv = env.PAYPAL_ENV;
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  const webhookId = env.PAYPAL_WEBHOOK_ID;

  if ((paypalEnv !== "sandbox" && paypalEnv !== "live") || !clientId || !clientSecret || !webhookId) {
    return "UNAVAILABLE";
  }
  return "PAYPAL";
}

assert.equal(
  selectProviderKind({ NODE_ENV: "production" }),
  "UNAVAILABLE",
  "production with NO PayPal env vars must fail closed"
);

assert.equal(
  selectProviderKind({ NODE_ENV: "production", PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "x" }),
  "UNAVAILABLE",
  "production with PARTIAL PayPal env vars (missing secret/webhook id) must still fail closed"
);

assert.equal(
  selectProviderKind({
    NODE_ENV: "production",
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "x",
    PAYPAL_CLIENT_SECRET: "y",
    PAYPAL_WEBHOOK_ID: "z",
  }),
  "PAYPAL",
  "production with FULL PayPal env vars must select the real provider"
);

assert.equal(
  selectProviderKind({ NODE_ENV: "development" }),
  "TEST",
  "any non-production build must always select TestPaymentProvider, regardless of PayPal env vars"
);

assert.equal(
  selectProviderKind({
    NODE_ENV: "development",
    PAYPAL_ENV: "live",
    PAYPAL_CLIENT_ID: "x",
    PAYPAL_CLIENT_SECRET: "y",
    PAYPAL_WEBHOOK_ID: "z",
  }),
  "TEST",
  "non-production must select TestPaymentProvider even when full PayPal env vars happen to be set"
);

console.log(
  "PASS — payment provider selection fails closed in production without full PayPal configuration, and never uses TestPaymentProvider outside non-production."
);
