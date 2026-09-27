"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ConfirmationResult } from "@/types/lead";
import { useQuote } from "@/lib/quote/quote-provider";
import { getLeadAdapter } from "@/lib/quote/lead/get-lead-adapter";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { formatCadMinor } from "@/lib/quote/units";
import { getStyleName } from "@/lib/quote/style-taxonomy";

const MATERIAL_LABELS: Record<string, string> = {
  INSTALL_ONLY: "Installation only",
  MATERIAL_AND_INSTALL: "Material + installation",
};

const TIMING_LABELS: Record<string, string> = {
  ASAP: "As soon as possible",
  WITHIN_2_WEEKS: "Within 1–2 weeks",
  WITHIN_MONTH: "Within a month",
  JUST_PLANNING: "Just planning",
};

/**
 * CRITICAL (spec sections 23–24): this component NEVER decides success
 * from client-side QuoteState, a query parameter, or localStorage — only
 * from `LeadAdapter.getConfirmation()`'s server response. A fresh browser
 * with no real, persisted BookingIntent always sees the "not found" state.
 */
export function ConfirmationStep() {
  const { quote, hydrated } = useQuote();
  const [result, setResult] = useState<ConfirmationResult | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !quote) return;
    // Ref-based dedupe (not a cancelled-on-cleanup flag — see PriceStep for
    // why that pattern discards the one real result under React
    // StrictMode's dev-only double-invoke).
    if (fetchedFor.current === quote.sessionId) return;
    fetchedFor.current = quote.sessionId;

    getLeadAdapter()
      .getConfirmation(quote.sessionId)
      .then((res) => {
        setResult(res);
        if (res.status === "confirmed") {
          getAnalyticsAdapter().track({ name: "quote_confirmation_viewed" });
        }
      });
  }, [hydrated, quote]);

  if (!hydrated || !quote || !result) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ink-muted">Checking your project…</p>
      </div>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-light text-purple-dark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v5M12 16h.01M12 3l9 16H3l9-16z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">No submitted project found</h1>
        <p className="mt-3 text-sm text-ink-muted">
          We couldn&apos;t find a submitted project for this session. If you completed a
          quote earlier, try starting a new one below.
        </p>
        <Link
          href="/quote"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-purple px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-purple-dark"
        >
          Start a new project
        </Link>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-light text-purple-dark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v5M12 16h.01M12 3l9 16H3l9-16z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">We couldn&apos;t verify your project</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Something went wrong checking your submission. Please refresh this page.
        </p>
      </div>
    );
  }

  const { summary, paymentStatus } = result;
  const isPaymentConfirmed = paymentStatus === "CAPTURED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Your project request is in.
      </h1>

      {/* Distinct from "project submitted" above — never implied by it alone. */}
      {isPaymentConfirmed ? (
        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-light px-3 py-1 text-sm font-semibold text-teal">
          Payment confirmed
        </p>
      ) : (
        <Link
          href="/quote/payment"
          className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-coral-light px-3 py-1 text-sm font-semibold text-ink"
        >
          Payment not yet completed — pay now
        </Link>
      )}

      <p className="mx-auto mt-4 max-w-md text-base text-ink-muted">
        A member of the Servino team will review your project and reach out to confirm
        next steps.
      </p>

      <div className="mt-8 rounded-2xl border border-border p-6 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What you submitted</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Project</dt>
            <dd className="font-medium text-ink">{summary.serviceName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Approximate area</dt>
            <dd className="font-medium text-ink">{summary.totalAreaM2} m²</dd>
          </div>
          {summary.styleId && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Style</dt>
              <dd className="font-medium text-ink">{getStyleName(summary.styleId) ?? summary.styleId}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-muted">Material</dt>
            <dd className="font-medium text-ink">{MATERIAL_LABELS[summary.materialOwnership]}</dd>
          </div>
          {summary.timing && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Timing</dt>
              <dd className="font-medium text-ink">{TIMING_LABELS[summary.timing] ?? summary.timing}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="font-semibold text-ink">Estimated total</dt>
            <dd className="font-semibold text-ink">{formatCadMinor(summary.totalMinor)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-xs text-ink-muted">
        This confirms Servino received your project request — it does not mean a
        professional has been assigned or an appointment has been scheduled yet.
      </p>
    </div>
  );
}
