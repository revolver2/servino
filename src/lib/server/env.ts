/**
 * Centralized production environment validation (Session H, spec
 * sections 11/85). This is NOT the only fail-closed mechanism in the
 * app — `getPaymentProvider()` (src/lib/payments/get-payment-provider.ts)
 * and `resolvePricing()` (D026) already independently fail closed for
 * their own concerns regardless of whether this module is ever called.
 * This module exists to give a single, explicit, pre-deploy-checkable
 * answer to "is this environment safe to serve real customers from,"
 * and to back the `/api/health` readiness check.
 *
 * Deliberately does NOT crash the process on import — Next.js has no
 * clean single startup hook for the App Router without a custom server
 * (not worth introducing one just for this). Instead:
 *   - `scripts/validate-production-env.mjs` runs this standalone as a
 *     pre-deploy gate (non-zero exit on failure).
 *   - `/api/health` calls `checkProductionEnv()` for its readiness check.
 */

export type EnvCheckResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

/**
 * Checks the environment this process is actually running in — safe to
 * call in any environment; only NODE_ENV === "production" is held to
 * the strict rules. Never throws, never logs the values of secrets.
 */
export function checkProductionEnv(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return { ok: true, errors, warnings: ["NODE_ENV is not \"production\" — production checks skipped."] };
  }

  // --- Database: required, must not silently point at a local/dev instance ---
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push("DATABASE_URL is not set.");
  } else if (LOCALHOST_PATTERN.test(databaseUrl)) {
    errors.push("DATABASE_URL points at localhost/127.0.0.1 — this must be the real production PostgreSQL instance.");
  }

  // --- Public site URL: required for correct metadata/OG/sitemap/robots/webhook callback URLs ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    errors.push("NEXT_PUBLIC_SITE_URL is not set — metadata, sitemap, and robots.txt would silently fall back to localhost.");
  } else if (LOCALHOST_PATTERN.test(siteUrl)) {
    errors.push("NEXT_PUBLIC_SITE_URL points at localhost — must be the real production domain.");
  } else if (!siteUrl.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_SITE_URL must be an https:// URL in production.");
  }

  // --- Mock pricing: must never be explicitly enabled in production ---
  if (process.env.NEXT_PUBLIC_USE_MOCK_PRICING === "true") {
    errors.push(
      "NEXT_PUBLIC_USE_MOCK_PRICING=true in a production build — this would serve fabricated prices to real customers (see D026)."
    );
  }

  // --- PayPal: not a hard failure here (getPaymentProvider() already fails
  // closed per-request if incomplete) — but surfaced as a warning so
  // /api/health and the pre-deploy script both make the gap visible
  // without duplicating the actual fail-closed logic in two places. ---
  const paypalEnv = process.env.PAYPAL_ENV;
  const paypalVarsPresent = [process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET, process.env.PAYPAL_WEBHOOK_ID];
  const paypalConfigured = (paypalEnv === "sandbox" || paypalEnv === "live") && paypalVarsPresent.every(Boolean);
  if (!paypalConfigured) {
    warnings.push(
      "PayPal is not fully configured (PAYPAL_ENV/PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET/PAYPAL_WEBHOOK_ID) — real payments will fail closed (UnavailablePaymentProvider), not fabricate success. This is safe but means no customer can pay yet."
    );
  }

  // --- Support contact: not a hard failure (the Contact page already
  // fails closed to an honest "being finalized" message if unset, see
  // src/lib/server/support-contact.ts) but worth surfacing so it isn't
  // forgotten before real customers arrive. ---
  if (!process.env.SUPPORT_EMAIL) {
    warnings.push(
      "SUPPORT_EMAIL is not set — the Contact page will show a placeholder instead of a real support address."
    );
  }

  // --- Admin bootstrap password: should never remain set after the one-time bootstrap run ---
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    warnings.push(
      "ADMIN_BOOTSTRAP_PASSWORD is still set in this environment — remove it after running `npm run admin:bootstrap` once (it is a real password, kept in the environment only as long as necessary)."
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * The production-safe site URL, with a single, centrally-logged fallback
 * (spec section 11 — never silently point at localhost without at least
 * a loud, visible signal). Used by layout/robots/sitemap instead of each
 * repeating `?? "http://localhost:3000"` independently.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    // Loud, not silent — this is exactly the situation D-numbered
    // decisions elsewhere in this project treat as a real production
    // misconfiguration, not a quiet default.
    console.error(
      "[env] NEXT_PUBLIC_SITE_URL is not set in a production build — falling back to http://localhost:3000, which is almost certainly wrong. Set NEXT_PUBLIC_SITE_URL."
    );
  }
  return "http://localhost:3000";
}
