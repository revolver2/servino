"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TimingValue } from "@/types/quote";
import { useQuote } from "@/lib/quote/quote-provider";
import { getLeadAdapter } from "@/lib/quote/lead/get-lead-adapter";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { getConversionAdapter } from "@/lib/quote/conversion/get-conversion-adapter";
import { LeadAdapterError } from "@/types/lead";

const options: { id: TimingValue; label: string }[] = [
  { id: "ASAP", label: "As soon as possible" },
  { id: "WITHIN_2_WEEKS", label: "Within 1–2 weeks" },
  { id: "WITHIN_MONTH", label: "Within a month" },
  { id: "JUST_PLANNING", label: "Just planning" },
];

export function TimingStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();

  const [selected, setSelected] = useState<TimingValue | null>(quote?.timing ?? null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!quote) return null;

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!selected) return;

    setSubmitting(true);
    const leadAdapter = getLeadAdapter();

    try {
      await leadAdapter.saveTiming(quote!.sessionId, selected);
      updateQuote({ timing: selected, currentStep: "timing" });
    } catch (err) {
      const message = err instanceof LeadAdapterError ? err.message : "Could not save your timing. Please try again.";
      setSubmitError(message);
      setSubmitting(false);
      return;
    }

    try {
      const { bookingIntentId } = await leadAdapter.markBookingIntent(quote!.sessionId);
      updateQuote({ bookingIntentId });
      analytics.track({ name: "booking_intent" });
      getConversionAdapter().sendConversion({
        name: "booking_intent",
        eventId: `${quote!.sessionId}_booking_intent`,
        timestamp: new Date().toISOString(),
      });
      router.push("/quote/payment");
    } catch (err) {
      const message =
        err instanceof LeadAdapterError ? err.message : "Could not submit your project. Please try again.";
      setSubmitError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        When would you like to get started?
      </h1>
      <p className="mt-2 text-sm text-ink-muted">Choose the option that best fits your project.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-purple bg-purple-light shadow-sm"
                  : "border-border bg-white hover:border-ink/20 motion-safe:hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-purple bg-purple" : "border-border bg-white"
                }`}
              >
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <p className="text-base font-semibold text-ink">{option.label}</p>
            </button>
          );
        })}
      </div>
      {touched && !selected && <p className="mt-2 text-sm text-coral-text">Choose a timing option to continue.</p>}

      {submitError && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-coral-text">
            <path
              d="M12 8v5M12 16h.01M12 3l9 16H3l9-16z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{submitError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit My Project"}
      </button>
    </div>
  );
}
