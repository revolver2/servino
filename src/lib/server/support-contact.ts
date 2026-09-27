/**
 * Servino support contact (Session H0.1, wording corrected H0.2).
 * Server-only — read at request time, not baked into a client bundle at
 * build time (unlike a `NEXT_PUBLIC_*` var — see
 * docs/PRODUCTION_DEPLOYMENT.md "Secrets" for why that distinction
 * matters). No fabricated email/phone/address is ever hardcoded here:
 * until `SUPPORT_EMAIL` is set to a real value, the Contact page shows
 * a neutral "being configured" message instead — never wording that
 * reads like a development placeholder (see `docs/DECISIONS.md`).
 * Missing config is a launch-readiness blocker
 * (`scripts/smoke-production.mjs`, `docs/LAUNCH_CHECKLIST.md`), not a
 * reason to fail the running app's health check.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getSupportEmail(): string | null {
  const value = process.env.SUPPORT_EMAIL?.trim();
  if (!value || !EMAIL_RE.test(value)) return null;
  return value;
}
