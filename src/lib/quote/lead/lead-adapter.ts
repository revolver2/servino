import type { Attribution, PhotoState, PriceResult, QuoteState } from "@/types/quote";
import type {
  CapturePaymentOrderResult,
  ConfirmationResult,
  ContactDetails,
  CreatePaymentOrderResult,
  PaymentStatusResult,
  TestPaymentScenario,
  TimingValue,
} from "@/types/lead";

/**
 * Lead persistence boundary (spec section 13, extended in B2 section 7).
 *
 * `ApiLeadAdapter` (B2's real implementation) calls the backend directly.
 * `DevLocalLeadAdapter` remains as a fully-functional offline/local
 * reference implementation. Every method throws `LeadAdapterError` on
 * failure rather than silently succeeding — components decide what to
 * show, but they never treat a failure as success.
 */
export interface LeadAdapter {
  createLead(sessionId: string, attribution: Attribution): Promise<void>;
  updateLead(sessionId: string, patch: Partial<QuoteState>): Promise<void>;
  saveQuoteProgress(sessionId: string, state: QuoteState): Promise<void>;
  attachMediaReference(sessionId: string, media: PhotoState): Promise<void>;
  saveContactDetails(sessionId: string, contact: ContactDetails): Promise<void>;
  /** Server-computed, authoritative price — never trust a client-only number (spec section 6). */
  markPriceViewed(sessionId: string): Promise<PriceResult>;
  saveTiming(sessionId: string, value: TimingValue): Promise<void>;
  /** Idempotent — a retried call for the same lead returns the same booking intent. */
  markBookingIntent(sessionId: string): Promise<{ bookingIntentId: string }>;
  /** Server-validated confirmation lookup — the only thing `/quote/confirmation` may trust. */
  getConfirmation(sessionId: string): Promise<ConfirmationResult>;
  getLeadBySession(sessionId: string): Promise<QuoteState | null>;

  // Session G — payment. The amount is always server-derived; nothing
  // here accepts a client-supplied total.
  getPaymentStatus(sessionId: string): Promise<PaymentStatusResult>;
  createPaymentOrder(sessionId: string, testScenario?: TestPaymentScenario): Promise<CreatePaymentOrderResult>;
  capturePaymentOrder(sessionId: string, providerOrderId: string): Promise<CapturePaymentOrderResult>;
}
