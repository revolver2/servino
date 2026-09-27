import type { MaterialOwnership, PriceResult } from "@/types/quote";

export type QuoteInput = {
  serviceSlug: string;
  serviceName: string;
  citySlug: string;
  totalAreaM2: number;
  materialOwnership: MaterialOwnership;
};

/**
 * Pricing boundary (spec section 9).
 *
 * This is the ONLY way UI code may obtain a price. Components must never
 * compute a price themselves. The frontend result is never authoritative —
 * once a real backend pricing engine exists (Phase E), a server must
 * recompute and validate price before anything financial (booking,
 * payment) can happen. Nothing in B1 treats this result as bookable.
 */
export interface PricingAdapter {
  calculate(input: QuoteInput): Promise<PriceResult>;
}
