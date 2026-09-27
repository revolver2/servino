/**
 * Servino quote funnel — domain types (Phase B1).
 *
 * This is intentionally separate from purely visual/component state
 * (open/closed menus, hover, etc). Everything here is state that a real
 * backend would eventually own — the frontend just carries it forward
 * until B2/Phase E introduce persistence and a real pricing engine.
 */

export type FunnelStep = "project" | "measurements" | "photo" | "style" | "price" | "contact" | "timing";

export const FUNNEL_STEPS: FunnelStep[] = [
  "project",
  "measurements",
  "photo",
  "style",
  "price",
  "contact",
  "timing",
];

// ---------------------------------------------------------------------------
// Timing (spec section 18) — not PII, safe to keep in client-side QuoteState.
// ---------------------------------------------------------------------------

export type TimingValue = "ASAP" | "WITHIN_2_WEEKS" | "WITHIN_MONTH" | "JUST_PLANNING";

// ---------------------------------------------------------------------------
// Location / serviceability
// ---------------------------------------------------------------------------

export type LocationState = {
  postalCode: string | null;
  citySlug: string | null;
  serviceable: boolean | null; // null = not yet validated
};

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export type MeasurementUnit = "metric" | "imperial";

export type WallMeasurement = {
  id: string;
  /** In the unit given by MeasurementsState.unit — metric = meters, imperial = feet. */
  width: number | null;
  height: number | null;
};

export type MeasurementsState = {
  unit: MeasurementUnit;
  walls: WallMeasurement[];
};

// ---------------------------------------------------------------------------
// Photo (dev-only media boundary — see lib/quote/media)
// ---------------------------------------------------------------------------

export type PhotoState =
  | { status: "none" }
  | { status: "skipped" }
  | {
      status: "selected";
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      /** In-memory-only object URL for local preview. Never persisted to storage. */
      previewObjectUrl: string;
    }
  | { status: "failed"; reason: string };

// ---------------------------------------------------------------------------
// Style + material ownership
// ---------------------------------------------------------------------------

/**
 * Session H0.2: styles are service-specific (see
 * src/lib/quote/style-taxonomy.ts for which of these are valid for which
 * service) — this union is now the full set across all services, not a
 * one-size-fits-all list every service showed regardless of relevance.
 * "marble" (generic) was retired in favor of the three specific marble
 * finishes below; nothing else was renamed.
 */
export type StyleId =
  // Wall Panels
  | "light-oak"
  | "natural-wood"
  | "dark-walnut"
  // Marble Sheets
  | "white-marble"
  | "grey-marble"
  | "black-marble"
  // Wallpaper
  | "neutral"
  | "textured"
  | "geometric"
  | "botanical"
  // Decorative Partitions
  | "wood-slat"
  | "minimal"
  // Shared neutrals (Wall Panels + Decorative Partitions)
  | "black"
  | "white";

export type MaterialOwnership = "INSTALL_ONLY" | "MATERIAL_AND_INSTALL";

// ---------------------------------------------------------------------------
// Price result — returned by PricingAdapter, never computed in components.
// Money is always integer minor units (cents) — never floating point.
// ---------------------------------------------------------------------------

export type PricingSource = "mock-dev" | "authoritative-versioned" | "unavailable";

export type PriceResult = {
  status: "ok" | "unavailable";
  currency: "CAD";
  serviceSlug: string;
  serviceName: string;
  totalAreaM2: number;
  materialOwnership: MaterialOwnership;
  /** Integer cents. */
  subtotalMinor: number;
  /** Integer cents. */
  taxMinor: number;
  /** Human label for the tax line — owned by the pricing boundary, not the UI. */
  taxLabel: string;
  /** Integer cents. */
  totalMinor: number;
  pricingSource: PricingSource;
  generatedAt: string;
  /** Present only when status is "unavailable". */
  unavailableReason?: string;
};

// ---------------------------------------------------------------------------
// Attribution — first-touch only, no PII.
// ---------------------------------------------------------------------------

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingRoute: string;
  referrer: string | null;
  firstTouchAt: string;
};

// ---------------------------------------------------------------------------
// Full quote state
// ---------------------------------------------------------------------------

export type QuoteState = {
  sessionId: string;
  currentStep: FunnelStep;
  serviceSlug: string | null;
  location: LocationState;
  measurements: MeasurementsState;
  photo: PhotoState;
  style: StyleId | null;
  materialOwnership: MaterialOwnership | null;
  price: PriceResult | null;
  attribution: Attribution;
  /**
   * Whether contact was successfully saved server-side — a boolean flag
   * only, never the name/email/phone itself (data minimization: contact
   * details live only in PostgreSQL, never in browser storage). This
   * exists purely so StepGuard can allow `/quote/timing` after a refresh
   * without re-fetching or caching PII client-side.
   */
  contactCaptured: boolean;
  /** Not PII — safe to keep client-side for resume/guard purposes. */
  timing: TimingValue | null;
  /** Set once `/api/lead/booking-intent` succeeds. Not itself a trust boundary — `/quote/confirmation` always re-verifies server-side. */
  bookingIntentId: string | null;
  updatedAt: string;
};

export function createEmptyQuoteState(sessionId: string, attribution: Attribution): QuoteState {
  return {
    sessionId,
    currentStep: "project",
    serviceSlug: null,
    location: { postalCode: null, citySlug: null, serviceable: null },
    measurements: { unit: "metric", walls: [{ id: makeWallId(), width: null, height: null }] },
    photo: { status: "none" },
    style: null,
    materialOwnership: null,
    price: null,
    attribution,
    contactCaptured: false,
    timing: null,
    bookingIntentId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function makeWallId(): string {
  return `wall_${Math.random().toString(36).slice(2, 10)}`;
}
