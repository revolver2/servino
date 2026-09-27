/**
 * Centralized rounding (spec section 50) — every money/percentage
 * computation in the pricing engine goes through these, so UI, API, and
 * tests can never quietly diverge on how a fraction of a cent is handled.
 *
 * Money is always integer minor units (cents); percentages of money are
 * rounded to the nearest cent using standard "round half away from zero"
 * semantics (`Math.round`), applied exactly once per derived amount —
 * never accumulated by rounding intermediate values twice.
 */

/** Rounds a fractional minor-unit amount (e.g. 12.5 cents) to the nearest whole cent. */
export function roundMinor(value: number): number {
  return Math.round(value);
}

/** Applies a percentage (e.g. 13 for 13%) to an integer minor-unit amount, rounded to the nearest cent. */
export function applyPercent(baseMinor: number, percent: number): number {
  return roundMinor((baseMinor * percent) / 100);
}

/** Rounds a ratio (0–1 or beyond) to a percentage with 2 decimal places, matching Decimal(6,2)/Decimal(5,2) columns. */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
