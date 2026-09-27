/**
 * Feature flags (spec section 57; operational kill switches added
 * Session H, spec sections 50–53).
 * Phase A: static defaults only — no admin UI or persistence yet.
 * Security-relevant behavior must never be gated only by a flag here;
 * flags control business/UX presentation, not access control.
 *
 * `acceptNewCustomers`, `acceptNewProfessionals`, `newBookings`, and
 * `paymentsEnabled` are Servino's real operational kill switches for
 * the first-10-jobs launch window — each is actually enforced
 * server-side (see the routes referenced below), not just cosmetic.
 * To flip one in an emergency: edit this file and redeploy (VPS
 * deploy is a fast `git pull` + restart, not a full outage — see
 * docs/LAUNCH_CHECKLIST.md "Emergency stop"). This is a deliberately
 * simple, static mechanism — no DB-backed admin toggle UI was built
 * for this (see docs/DECISIONS.md for why, and the tradeoff it
 * accepts: a flip requires a deploy, not a live admin click).
 */
export const featureFlags = {
  acceptNewCustomers: true,
  // Gates POST /api/admin/professionals (professional creation). OFF
  // blocks onboarding new professionals; existing ones are unaffected.
  acceptNewProfessionals: true,
  // Gates POST /api/lead/booking-intent (the moment a Job is actually
  // created). OFF stops new bookings while leaving the whole marketing
  // site and quote-browsing experience reachable (spec section 51).
  newBookings: true,
  customerChoice: false,
  autoMatch: false,
  referralProgram: false,
  // Session G — real customer PayPal checkout exists behind this flag.
  // OFF must mean no payment route is presented to a customer, never a
  // fake "paid" success (spec section 64). Independent of
  // `getPaymentProvider()`'s own fail-closed production gate below —
  // this flag controls UI presentation, that gate controls whether real
  // money can move at all.
  paymentsEnabled: true,
  // Automated marketplace/Payouts-API disbursement was not implemented
  // this session (D039) — PayPal partner/business approval for
  // Multiparty/Payouts could not be verified. Stays OFF until that
  // changes; the manual (Mode B) payout workflow does not depend on it.
  automaticPayouts: false,
  professionalAiOutreach: false,
  promoCodes: false,
  liveTracking: false,
  aiWallVisualization: false,

  // Homepage content — off until verified/real assets exist.
  showBeforeAfter: false,
  showInspirationGallery: true,
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

export function isEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag];
}
