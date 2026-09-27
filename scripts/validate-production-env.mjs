#!/usr/bin/env node
// Pre-deploy production environment gate (spec section 11/85).
// Mirrors src/lib/server/env.ts's checkProductionEnv() logic — kept as a
// plain-JS duplicate rather than importing the TS module, same
// cross-boundary-avoidance precedent already used by the Playwright test
// helpers (see tests/e2e/helpers/admin.ts). If these two ever drift,
// that's a real thing to catch on the next review of either file.
//
// Usage: NODE_ENV=production node scripts/validate-production-env.mjs
// Exit code 0 = safe to deploy. Non-zero = STOP, do not deploy.
// Never prints secret values, only which variables are missing/wrong.

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

function check() {
  const errors = [];
  const warnings = [];

  if (process.env.NODE_ENV !== "production") {
    console.log("NODE_ENV is not \"production\" — nothing to validate. Set NODE_ENV=production to run this for real.");
    return { ok: true, errors, warnings };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push("DATABASE_URL is not set.");
  } else if (LOCALHOST_PATTERN.test(databaseUrl)) {
    errors.push("DATABASE_URL points at localhost/127.0.0.1 — must be the real production PostgreSQL instance.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    errors.push("NEXT_PUBLIC_SITE_URL is not set.");
  } else if (LOCALHOST_PATTERN.test(siteUrl)) {
    errors.push("NEXT_PUBLIC_SITE_URL points at localhost — must be the real production domain.");
  } else if (!siteUrl.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_SITE_URL must be an https:// URL in production.");
  }

  if (process.env.NEXT_PUBLIC_USE_MOCK_PRICING === "true") {
    errors.push("NEXT_PUBLIC_USE_MOCK_PRICING=true — would serve fabricated prices to real customers.");
  }

  const paypalEnv = process.env.PAYPAL_ENV;
  const paypalVarsPresent = [process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET, process.env.PAYPAL_WEBHOOK_ID];
  const paypalConfigured = (paypalEnv === "sandbox" || paypalEnv === "live") && paypalVarsPresent.every(Boolean);
  if (!paypalConfigured) {
    warnings.push(
      "PayPal is not fully configured — real payments will fail closed (safe), but no customer can pay yet. Set PAYPAL_ENV/PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET/PAYPAL_WEBHOOK_ID before go-live."
    );
  }

  if (!process.env.SUPPORT_EMAIL) {
    warnings.push("SUPPORT_EMAIL is not set — the Contact page will show a placeholder instead of a real support address.");
  }

  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    warnings.push("ADMIN_BOOTSTRAP_PASSWORD is still set — remove it from the environment after the one-time bootstrap run.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

const result = check();

for (const w of result.warnings) console.warn(`WARN: ${w}`);
for (const e of result.errors) console.error(`ERROR: ${e}`);

if (!result.ok) {
  console.error(`\nFAIL — ${result.errors.length} blocking issue(s). Do not deploy.`);
  process.exit(1);
}

console.log(`\nPASS — production environment configuration is valid.${result.warnings.length ? " (see warnings above)" : ""}`);
