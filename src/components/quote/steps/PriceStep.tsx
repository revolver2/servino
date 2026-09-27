"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PriceResult } from "@/types/quote";
import { useQuote } from "@/lib/quote/quote-provider";
import { getLeadAdapter } from "@/lib/quote/lead/get-lead-adapter";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { getConversionAdapter } from "@/lib/quote/conversion/get-conversion-adapter";
import { formatCadMinor } from "@/lib/quote/units";
import { getEnabledServices } from "@/lib/services-data";
import { getStyleName } from "@/lib/quote/style-taxonomy";

const MATERIAL_LABELS: Record<string, string> = {
  INSTALL_ONLY: "Installation only",
  MATERIAL_AND_INSTALL: "Material + installation",
};

type LoadState = "loading" | "ready" | "failed";

export function PriceStep() {
  const { quote, updateQuote } = useQuote();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const firedForRetry = useRef(-1);

  const service = quote?.serviceSlug ? getEnabledServices().find((s) => s.slug === quote.serviceSlug) : undefined;

  useEffect(() => {
    if (!quote || !service) return;
    // Dedupe React StrictMode's dev-only double-invoke for the same retry
    // generation — the server call below isn't safe to fire twice (it
    // creates a new QuoteSnapshot row per call). Deliberately NOT using a
    // cancelled-on-cleanup flag here: StrictMode's synthetic cleanup fires
    // on the very instance whose in-flight request we want to keep, so
    // that pattern would discard the one real result instead of the
    // duplicate. The ref below is the only guard needed.
    if (firedForRetry.current === retryKey) return;
    firedForRetry.current = retryKey;

    async function run() {
      // The server is the source of truth for price (spec section 6): it
      // recomputes from the lead's already-persisted, already-validated
      // inputs rather than trusting anything the client sends.
      const result = await getLeadAdapter().markPriceViewed(quote!.sessionId);

      updateQuote({ price: result });
      getAnalyticsAdapter().track({ name: "price_generated", pricingSource: result.pricingSource });
      getAnalyticsAdapter().track({ name: "price_viewed" });

      if (result.status === "ok") {
        getConversionAdapter().sendConversion({
          name: "price_generated",
          eventId: `${quote!.sessionId}_price_generated`,
          timestamp: result.generatedAt,
        });
        setLoadState("ready");
      } else {
        setLoadState("failed");
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.sessionId, retryKey]);

  if (!quote || !service) return null;

  if (loadState === "loading") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6">
        <span className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-2 border-purple-light border-t-purple" />
        <p className="mt-4 text-sm text-ink-muted">Calculating your price…</p>
      </div>
    );
  }

  if (loadState === "failed" || quote.price?.status !== "ok") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">We couldn&apos;t generate a price</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {quote.price?.unavailableReason ?? "Something went wrong. Please try again."}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadState("loading");
            setRetryKey((k) => k + 1);
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-purple px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-purple-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  const price = quote.price as PriceResult;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Your Servino price</h1>

      <div className="mt-6 rounded-3xl bg-ink px-6 py-8 text-center">
        <p className="text-sm font-medium text-white/60">Total (incl. tax)</p>
        <p className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
          {formatCadMinor(price.totalMinor)}
        </p>
        <p className="mt-1 text-sm text-white/60">CAD</p>

        <Link
          href="/quote/contact"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark sm:w-auto"
        >
          Continue with this estimate
        </Link>
        <p className="mt-3 text-xs text-white/50">
          Next, we&apos;ll ask for your contact and timing details. Your project isn&apos;t
          confirmed until you&apos;ve completed the payment and Servino confirmation steps
          that follow.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What&apos;s priced</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Project</dt>
            <dd className="font-medium text-ink">{service.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Total area</dt>
            <dd className="font-medium text-ink">{price.totalAreaM2} m²</dd>
          </div>
          {quote.style && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Style</dt>
              <dd className="font-medium text-ink">{getStyleName(quote.style) ?? quote.style}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-muted">Includes</dt>
            <dd className="font-medium text-ink">{MATERIAL_LABELS[price.materialOwnership]}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-ink-muted">Subtotal</span>
          <span className="font-medium text-ink">{formatCadMinor(price.subtotalMinor)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-ink-muted">{price.taxLabel}</span>
          <span className="font-medium text-ink">{formatCadMinor(price.taxMinor)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-2.5 text-base">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">{formatCadMinor(price.totalMinor)}</span>
        </div>
      </div>
    </div>
  );
}
