import type { LeadFunnelStep, LeadStatus } from "@prisma/client";

/**
 * Lead status only ever moves forward. A stale/out-of-order request (e.g.
 * a retried `progress` save arriving after `contact` already succeeded)
 * must never regress status back to an earlier stage.
 */
const STATUS_ORDER: LeadStatus[] = [
  "QUOTE_STARTED",
  "QUOTE_PARTIAL",
  "PRICE_VIEWED",
  "CONTACT_CAPTURED",
  "BOOKING_INTENT",
];

export function furthestStatus(current: LeadStatus, candidate: LeadStatus): LeadStatus {
  return STATUS_ORDER.indexOf(candidate) > STATUS_ORDER.indexOf(current) ? candidate : current;
}

/**
 * Same monotonic principle for `currentStep`. Concretely fixes a real
 * ordering race: the client's generic progress-sync call (fired from
 * `updateQuote()` after booking-intent succeeds, still carrying the
 * pre-booking-intent local `currentStep`) would otherwise land AFTER —
 * and overwrite — the "CONFIRMATION" step that `/api/lead/booking-intent`
 * had just set moments earlier in its own transaction.
 */
const STEP_ORDER: LeadFunnelStep[] = [
  "PROJECT",
  "MEASUREMENTS",
  "PHOTO",
  "STYLE",
  "PRICE",
  "CONTACT",
  "TIMING",
  "CONFIRMATION",
];

export function furthestStep(current: LeadFunnelStep, candidate: LeadFunnelStep): LeadFunnelStep {
  return STEP_ORDER.indexOf(candidate) > STEP_ORDER.indexOf(current) ? candidate : current;
}
