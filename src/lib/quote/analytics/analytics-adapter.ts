import type { MaterialOwnership, PricingSource } from "@/types/quote";

/**
 * Typed analytics events (spec section 14). The union is deliberately
 * built from IDs/enums/numbers only — there is no field on any variant
 * that could carry name/email/phone/address/image bytes, so a PII leak
 * would be a type error, not just a code-review miss.
 */
export type AnalyticsEvent =
  | { name: "homepage_view" }
  | { name: "landing_page_view"; landingSlug: string }
  | { name: "service_selected"; serviceSlug: string }
  | { name: "quote_started" }
  | { name: "location_completed"; citySlug: string }
  | { name: "measurements_completed"; totalAreaM2: number; wallCount: number }
  | { name: "photo_uploaded" }
  | { name: "photo_skipped" }
  | { name: "style_selected"; styleId: string }
  | { name: "material_ownership_selected"; materialOwnership: MaterialOwnership }
  | { name: "price_generated"; pricingSource: PricingSource }
  | { name: "price_viewed" }
  | { name: "contact_started" }
  | { name: "contact_captured" }
  | { name: "booking_intent" }
  | { name: "quote_confirmation_viewed" }
  // Session H (spec section 32) — the rest of the funnel event list
  // (job_offered, professional_accepted, work_started,
  // completion_reported, customer_confirmed, job_closed) is
  // operational, not anonymous-browser-funnel data: it already exists
  // as real `AuditEvent` rows (JOB_OFFERED, JOB_OFFER_ACCEPTED,
  // JOB_STARTED, JOB_COMPLETION_REPORTED,
  // CUSTOMER_COMPLETION_CONFIRMED/ADMIN_COMPLETION_CONFIRMED) generated
  // from the admin/pro apps — see docs/PROJECT_STATUS.md "Session H —
  // Analytics" for the full mapping. Deliberately NOT wired into this
  // adapter: it exists to feed ad-platform pixels from the anonymous
  // customer browser, and admin/pro app events have no ad-attribution
  // value — piping them through here would risk leaking operational
  // data to a third-party ad platform for no reason.
  | { name: "checkout_started" }
  | { name: "payment_created" }
  /** `totalMinor` is the already-customer-visible quoted total — not PII, included for ad-platform purchase-value/ROAS tracking. */
  | { name: "payment_confirmed"; totalMinor: number };

/**
 * Components depend on this interface only — never on Meta Pixel, GA, or
 * any specific provider's SDK directly (spec section 14).
 */
export interface AnalyticsAdapter {
  track(event: AnalyticsEvent): void;
}
