/**
 * Consent architecture boundary (spec sections 14–16).
 *
 * This is intentionally a small, configurable policy object rather than a
 * consent-management UI library. B2 does not collect marketing consent at
 * all — there is no marketing feature yet to attach it to — so the only
 * consent evidence recorded is ESSENTIAL/operational (spec section 4/15):
 * "the customer provided contact details for the stated purpose of a
 * project quote follow-up." That's a fact about what happened, not an
 * invented opt-in.
 *
 * `mode` exists so a stricter jurisdiction (spec section 16) can later
 * require a blocking consent UI before any non-essential processing —
 * but the current, and only implemented, configuration is NOTICE for
 * Toronto/Ontario: no blocking modal, evidence recorded server-side for
 * the essential processing that already has a lawful, stated purpose.
 * See docs/research/CANADA_COMMUNICATION_CONSENT.md for the open
 * questions behind this choice.
 */

export type ConsentMode = "NOTICE" | "OPT_OUT" | "OPT_IN" | "STRICT";
export type ConsentCategoryKey = "ESSENTIAL" | "ANALYTICS" | "MARKETING";

export type JurisdictionConsentConfig = {
  jurisdiction: string;
  mode: ConsentMode;
  /** Categories that must have an explicit, unchecked-by-default opt-in UI before they may run. */
  requiresExplicitOptIn: ConsentCategoryKey[];
  wordingVersion: string;
};

export const CURRENT_JURISDICTION_CONFIG: JurisdictionConsentConfig = {
  jurisdiction: "CA-ON",
  mode: "NOTICE",
  // Marketing is never pre-checked and B2 doesn't collect it at all (spec
  // section 14) — listed here so the day a marketing opt-in UI is built,
  // the "never pre-checked" rule is enforced by this config, not
  // rediscovered ad hoc.
  requiresExplicitOptIn: ["MARKETING"],
  wordingVersion: "b2-v1",
};

export function requiresExplicitOptIn(category: ConsentCategoryKey): boolean {
  return CURRENT_JURISDICTION_CONFIG.requiresExplicitOptIn.includes(category);
}
