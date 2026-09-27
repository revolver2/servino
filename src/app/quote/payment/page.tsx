import type { Metadata } from "next";
import { PaymentStep } from "@/components/quote/steps/PaymentStep";

export const metadata: Metadata = { title: "Payment" };

/**
 * Deliberately NOT wrapped in `StepGuard` (same reasoning as
 * `/quote/confirmation`) — that component trusts client-side
 * QuoteState, which is exactly what must never gate a payment page
 * (spec sections 14/23–24). `PaymentStep` only trusts
 * `LeadAdapter.getPaymentStatus()`'s server response.
 *
 * No job/payment ID appears in this route (D040) — the customer's
 * session identifies which payment to show, the same
 * sessionId-in-POST-body pattern every other `/api/lead/*` route
 * already uses, never a guessable `/checkout/[jobId]`.
 */
export default function PaymentPage() {
  return <PaymentStep />;
}
