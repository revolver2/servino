"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaymentStatusResult, TestPaymentScenario } from "@/types/lead";
import { LeadAdapterError } from "@/types/lead";
import { useQuote } from "@/lib/quote/quote-provider";
import { getLeadAdapter } from "@/lib/quote/lead/get-lead-adapter";
import { formatCadMinor } from "@/lib/quote/units";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { getConversionAdapter } from "@/lib/quote/conversion/get-conversion-adapter";

const isNonProduction = process.env.NODE_ENV !== "production";

/**
 * CRITICAL (spec sections 14/23–24): the amount shown and paid is always
 * whatever `LeadAdapter.getPaymentStatus()` returns from the server —
 * never a value computed or remembered client-side. "Payment confirmed"
 * is only ever shown after the server-side capture call itself reports
 * success; a PayPal popup closing, or this component's own optimism,
 * never counts.
 */
export function PaymentStep() {
  const { quote, hydrated } = useQuote();
  const router = useRouter();
  const [result, setResult] = useState<PaymentStatusResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testScenario, setTestScenario] = useState<TestPaymentScenario>("SUCCESS");
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !quote) return;
    if (fetchedFor.current === quote.sessionId) return;
    fetchedFor.current = quote.sessionId;

    getLeadAdapter()
      .getPaymentStatus(quote.sessionId)
      .then((res) => {
        if (res.status === "found" && res.payment.status === "CAPTURED") {
          router.replace("/quote/confirmation");
          return;
        }
        if (res.status === "found" && res.paymentsEnabled) {
          getAnalyticsAdapter().track({ name: "checkout_started" });
        }
        setResult(res);
      });
  }, [hydrated, quote, router]);

  async function handlePay() {
    if (!quote) return;
    setSubmitting(true);
    setError(null);
    setPending(false);

    const adapter = getLeadAdapter();

    try {
      const order = await adapter.createPaymentOrder(quote.sessionId, isNonProduction ? testScenario : undefined);
      if ("alreadyCaptured" in order) {
        router.push("/quote/confirmation");
        return;
      }
      getAnalyticsAdapter().track({ name: "payment_created" });

      const capture = await adapter.capturePaymentOrder(quote.sessionId, order.providerOrderId);
      if (capture.captured) {
        const totalMinor = result?.status === "found" ? result.amount.totalMinor : order.amountMinor;
        getAnalyticsAdapter().track({ name: "payment_confirmed", totalMinor });
        getConversionAdapter().sendConversion({
          name: "payment_confirmed",
          eventId: `${quote.sessionId}_payment_confirmed`,
          timestamp: new Date().toISOString(),
        });
        router.push("/quote/confirmation");
        return;
      }
      if (capture.pending) {
        setPending(true);
        setSubmitting(false);
        return;
      }
      setError("Your payment could not be confirmed. Please try again.");
      setSubmitting(false);
    } catch (err) {
      const message = err instanceof LeadAdapterError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  }

  if (!hydrated || !quote || !result) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">No submitted project found</h1>
        <p className="mt-3 text-sm text-ink-muted">
          We couldn&apos;t find a submitted project for this session. If you completed a quote earlier, try
          starting a new one below.
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

  const { amount } = result;

  if (!result.paymentsEnabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Payment isn&apos;t available right now</h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-muted">
          Your project is submitted and saved. We&apos;re not able to take payment online at this exact moment —
          a member of the Servino team will reach out to arrange next steps.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Confirm and pay</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your project is submitted. Payment secures your spot and lets us offer your job to a professional.
      </p>

      <div className="mt-6 rounded-2xl border border-border p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What you&apos;re paying for</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="font-medium text-ink">{formatCadMinor(amount.subtotalMinor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">{amount.taxLabel}</dt>
            <dd className="font-medium text-ink">{formatCadMinor(amount.taxMinor)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="font-semibold text-ink">Total due today</dt>
            <dd className="font-semibold text-ink">{formatCadMinor(amount.totalMinor)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Payment is collected securely by PayPal. If your project can&apos;t proceed, contact us — refunds are
        reviewed and issued back to your original payment method.
      </p>

      {pending && (
        <div className="mt-4 rounded-xl bg-purple-light px-4 py-3 text-sm text-ink" role="status">
          Your payment is being processed. This can take a moment — no need to submit again.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink" role="alert">
          {error}
        </div>
      )}

      {isNonProduction && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-xs text-ink-muted">
          <label htmlFor="test-scenario" className="font-semibold">
            Test mode — simulated payment outcome
          </label>
          <select
            id="test-scenario"
            value={testScenario}
            onChange={(e) => setTestScenario(e.target.value as TestPaymentScenario)}
            className="mt-1 block w-full rounded border border-border bg-white px-2 py-1 text-ink"
          >
            <option value="SUCCESS">Success</option>
            <option value="DECLINE">Declined</option>
            <option value="OUTAGE">Provider outage</option>
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Processing…" : `Pay ${formatCadMinor(amount.totalMinor)} with PayPal`}
      </button>
    </div>
  );
}
