import type { Metadata } from "next";
import { ConfirmationStep } from "@/components/quote/steps/ConfirmationStep";

export const metadata: Metadata = { title: "Project Submitted" };

/**
 * Deliberately NOT wrapped in `StepGuard` — that component trusts
 * client-side QuoteState, which is exactly what spec sections 23–24
 * forbid trusting here. `ConfirmationStep` itself only trusts
 * `LeadAdapter.getConfirmation()`'s server response.
 */
export default function ConfirmationPage() {
  return <ConfirmationStep />;
}
