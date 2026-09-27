import type { MaterialOwnership, PriceResult, TimingValue } from "./quote";

export type { TimingValue };

export type ContactDetails = {
  firstName: string;
  email: string;
  phone: string;
  /** Hidden field — a real user never fills this in. See spam-signals.ts. */
  honeypot?: string;
  /** ISO timestamp of when the contact form was rendered — timing signal, not proof. */
  formRenderedAt?: string;
};

export type ConfirmationResult =
  | { status: "not_found" }
  | { status: "error" }
  | {
      status: "confirmed";
      summary: {
        serviceName: string;
        totalAreaM2: number;
        materialOwnership: MaterialOwnership;
        styleId: string | null;
        timing: TimingValue | null;
        currency: string;
        totalMinor: number;
      };
      /** Distinct from "project submitted" (spec — never collapse the two states). Null if payment hasn't started. */
      paymentStatus: string | null;
    };

export type { PriceResult };

// ---------------------------------------------------------------------------
// Payment (Session G) — server-authoritative only; nothing here is ever
// computed or trusted client-side (spec sections 14/23–24).
// ---------------------------------------------------------------------------

export type PaymentStatusResult =
  | { status: "not_found" }
  | {
      status: "found";
      /** Session H kill switch (spec section 17) — false means show a truthful "unavailable" state, never a payment form that would just fail. */
      paymentsEnabled: boolean;
      amount: { currency: string; subtotalMinor: number; taxMinor: number; taxLabel: string; totalMinor: number };
      payment: { status: string; providerOrderId: string | null };
    };

export type CreatePaymentOrderResult =
  | { alreadyCaptured: true; status?: string }
  | { providerOrderId: string; amountMinor: number; currency: string };

export type CapturePaymentOrderResult = { captured: boolean; pending?: boolean };

/** Only ever honored by the server outside production — see src/lib/payments/test-payment-provider.ts. */
export type TestPaymentScenario = "SUCCESS" | "DECLINE" | "OUTAGE";

/** Thrown by LeadAdapter methods on failure — components catch this and show a recoverable error, never a fake success. */
export class LeadAdapterError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LeadAdapterError";
    this.code = code;
  }
}
