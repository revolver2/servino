/**
 * Conversion boundary (spec section 15). Deliberately minimal in B1 — no
 * Meta/Google CAPI integration yet, no hashed identifiers transmitted
 * anywhere. This exists so that work is a config/implementation change
 * behind this interface later, not a rewrite of funnel components.
 */
export type ConversionEventName = "quote_started" | "price_generated" | "booking_intent" | "payment_confirmed";

export type ConversionEvent = {
  name: ConversionEventName;
  /** Internal ID — lets a future browser+server pair dedupe the same event. */
  eventId: string;
  timestamp: string;
};

export interface ConversionAdapter {
  sendConversion(event: ConversionEvent): void;
}
