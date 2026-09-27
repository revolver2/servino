/**
 * ============================================================================
 * DEVELOPMENT-ONLY PRICING CONFIGURATION
 * ============================================================================
 *
 * These numbers exist ONLY to exercise the quote funnel end-to-end during
 * B1 (architecture/UX testing). They are NOT researched Toronto market
 * rates, NOT a commercial price list, and MUST NOT be treated as real
 * pricing by anyone reading this file. Spec section 10/25/etc. explicitly
 * defers real Toronto pricing research to a later phase
 * (`docs/research/SERVICE_PRICING_RESEARCH.md`, Phase E).
 *
 * The Ontario HST rate below is a real, publicly known tax rate (used so
 * the funnel's tax line is not obviously fake) — it is NOT "business
 * pricing logic" and is kept separate from the per-service dev rates.
 * ============================================================================
 */

export const DEV_ONTARIO_HST_RATE = 0.13;
export const DEV_ONTARIO_HST_LABEL = "HST (13%)";

/** Flat dev-only rate per m², in CAD cents, keyed by service slug. */
export const DEV_INSTALL_ONLY_RATE_PER_M2_MINOR: Record<string, number> = {
  "wall-panels": 8500,
  "marble-sheets": 12000,
  wallpaper: 4500,
  "decorative-partitions": 9500,
};

/** Additional dev-only material rate per m², in CAD cents, added when Servino supplies material. */
export const DEV_MATERIAL_RATE_PER_M2_MINOR: Record<string, number> = {
  "wall-panels": 6000,
  "marble-sheets": 15000,
  wallpaper: 3000,
  "decorative-partitions": 5000,
};

/** Dev-only minimum project subtotal, in CAD cents, regardless of area. */
export const DEV_MINIMUM_SUBTOTAL_MINOR = 45000;
