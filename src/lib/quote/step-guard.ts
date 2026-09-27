import type { FunnelStep, QuoteState } from "@/types/quote";
import { totalAreaM2 } from "./units";

const STEP_ORDER: FunnelStep[] = [
  "project",
  "measurements",
  "photo",
  "style",
  "price",
  "contact",
  "timing",
];

/** Whether the step's OWN data has been filled in (independent of earlier steps). */
export function isStepComplete(quote: QuoteState, step: FunnelStep): boolean {
  switch (step) {
    case "project":
      return Boolean(quote.serviceSlug) && quote.location.serviceable === true;
    case "measurements":
      return totalAreaM2(quote.measurements) > 0;
    case "photo":
      return quote.photo.status !== "none";
    case "style":
      return Boolean(quote.style) && Boolean(quote.materialOwnership);
    case "price":
      return quote.price?.status === "ok";
    case "contact":
      // Contact details themselves are never cached client-side (data
      // minimization) — this flag is the only local record that the
      // server-side save succeeded.
      return quote.contactCaptured === true;
    case "timing":
      return quote.timing !== null;
    default:
      return false;
  }
}

/**
 * Whether a step is safe to render right now — every step before it must
 * already be complete. Mirrors the Phase A rule that a later funnel step
 * (like the old `/quote/confirmation`) must never render without the
 * state that should have produced it (spec section 93).
 */
export function isStepUnlocked(quote: QuoteState, step: FunnelStep): boolean {
  const index = STEP_ORDER.indexOf(step);
  for (let i = 0; i < index; i++) {
    if (!isStepComplete(quote, STEP_ORDER[i])) return false;
  }
  return true;
}

/** The step the user should be redirected to: the first one not yet complete. */
export function firstIncompleteStep(quote: QuoteState): FunnelStep {
  for (const step of STEP_ORDER) {
    if (!isStepComplete(quote, step)) return step;
  }
  return STEP_ORDER[STEP_ORDER.length - 1];
}

export function stepRoute(step: FunnelStep): string {
  return `/quote/${step}`;
}
