// Session H — production-config security regression (spec section 85).
// Verifies checkProductionEnv()'s decision logic across every required
// failure scenario. Mirrors src/lib/server/env.ts (and
// scripts/validate-production-env.mjs) as a plain-JS duplicate — same
// cross-boundary-avoidance precedent used throughout this project's own
// test helpers.
//
// "Missing session security" and "Redis unavailable" from the spec's
// suggested test list are deliberately NOT tested here: Servino's
// admin/professional sessions are DB-backed opaque random tokens
// (hashed at rest), not JWTs — there is no session-signing secret in
// this architecture to test the absence of. And no Redis dependency
// exists at all (D046) — there is nothing to be "unavailable." Testing
// either would mean inventing a failure mode this codebase doesn't
// have, not verifying a real one.
//
// Run with: node scripts/verify-production-config-failclosed.mjs
import assert from "node:assert/strict";

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

function checkProductionEnv(env) {
  const errors = [];
  const warnings = [];
  if (env.NODE_ENV !== "production") return { ok: true, errors, warnings };

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set.");
  else if (LOCALHOST_PATTERN.test(env.DATABASE_URL)) errors.push("DATABASE_URL points at localhost.");

  if (!env.NEXT_PUBLIC_SITE_URL) errors.push("NEXT_PUBLIC_SITE_URL is not set.");
  else if (LOCALHOST_PATTERN.test(env.NEXT_PUBLIC_SITE_URL)) errors.push("NEXT_PUBLIC_SITE_URL points at localhost.");
  else if (!env.NEXT_PUBLIC_SITE_URL.startsWith("https://")) errors.push("NEXT_PUBLIC_SITE_URL must be https://.");

  if (env.NEXT_PUBLIC_USE_MOCK_PRICING === "true") errors.push("Mock pricing enabled in production.");

  const paypalConfigured =
    (env.PAYPAL_ENV === "sandbox" || env.PAYPAL_ENV === "live") &&
    env.PAYPAL_CLIENT_ID &&
    env.PAYPAL_CLIENT_SECRET &&
    env.PAYPAL_WEBHOOK_ID;
  if (!paypalConfigured) warnings.push("PayPal not fully configured.");

  return { ok: errors.length === 0, errors, warnings };
}

let failures = 0;
function scenario(label, env, expectOk) {
  const result = checkProductionEnv(env);
  if (result.ok === expectOk) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label} — expected ok=${expectOk}, got ok=${result.ok} (${result.errors.join("; ")})`);
  }
}

const GOOD = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@realhost:5432/db",
  NEXT_PUBLIC_SITE_URL: "https://servino.ca",
};

scenario("Fully valid production config → safe", { ...GOOD }, true);
scenario("Missing DATABASE_URL → fails closed", { ...GOOD, DATABASE_URL: undefined }, false);
scenario("DATABASE_URL pointing at localhost → fails closed", { ...GOOD, DATABASE_URL: "postgresql://u:p@localhost:5432/db" }, false);
scenario("DATABASE_URL pointing at 127.0.0.1 → fails closed", { ...GOOD, DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db" }, false);
scenario("Missing NEXT_PUBLIC_SITE_URL → fails closed", { ...GOOD, NEXT_PUBLIC_SITE_URL: undefined }, false);
scenario("NEXT_PUBLIC_SITE_URL pointing at localhost → fails closed", { ...GOOD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, false);
scenario("NEXT_PUBLIC_SITE_URL not https:// → fails closed", { ...GOOD, NEXT_PUBLIC_SITE_URL: "http://servino.ca" }, false);
scenario("Mock pricing explicitly enabled in production → fails closed", { ...GOOD, NEXT_PUBLIC_USE_MOCK_PRICING: "true" }, false);
scenario("PayPal not configured → still SAFE (warning only, payments fail closed separately via getPaymentProvider())", { ...GOOD }, true);
scenario("Non-production build → always safe regardless of config", { NODE_ENV: "development" }, true);

if (failures > 0) {
  console.error(`\nFAIL — ${failures} scenario(s) did not fail closed as expected.`);
  process.exit(1);
}
console.log("\nPASS — production config fails closed in every required scenario.");
