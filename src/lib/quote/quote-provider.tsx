"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuoteState } from "@/types/quote";
import { createEmptyQuoteState } from "@/types/quote";
import { getOrCreateSessionId } from "./session";
import { captureAttributionOnce } from "./attribution";
import { isStale } from "./storage";
import { getLeadAdapter } from "./lead/get-lead-adapter";
import { getAnalyticsAdapter } from "./analytics/get-analytics-adapter";

/** Abandoned-quote threshold — older in-progress quotes start fresh rather than silently resuming. */
const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;

type QuoteContextValue = {
  quote: QuoteState | null;
  hydrated: boolean;
  updateQuote: (patch: Partial<QuoteState>) => void;
};

const QuoteContext = createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const leadAdapter = useMemo(() => getLeadAdapter(), []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const sessionId = getOrCreateSessionId();
      const attribution = captureAttributionOnce();
      const existing = await leadAdapter.getLeadBySession(sessionId);
      if (cancelled) return;

      const resolved =
        existing && !isStale(existing.updatedAt, QUOTE_TTL_MS)
          ? existing
          : createEmptyQuoteState(sessionId, attribution);

      if (!existing || isStale(existing.updatedAt, QUOTE_TTL_MS)) {
        // Best-effort sync with the server. A failure here (network blip,
        // rate limit, momentary outage) must not trap the whole funnel in
        // "Loading your project…" forever — the local state is still
        // valid and usable, and every explicit step past this point
        // (price, contact, timing, booking intent) surfaces its own
        // error through LeadAdapterError if the server is unreachable.
        try {
          await leadAdapter.createLead(sessionId, attribution);
          if (cancelled) return;
          await leadAdapter.saveQuoteProgress(sessionId, resolved);
        } catch (err) {
          console.error("[QuoteProvider] initial sync with server failed — continuing with local state", err);
        }
        if (cancelled) return;
        getAnalyticsAdapter().track({ name: "quote_started" });
      }

      if (!cancelled) {
        setQuote(resolved);
        setHydrated(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [leadAdapter]);

  const updateQuote = useCallback(
    (patch: Partial<QuoteState>) => {
      setQuote((prev) => {
        if (!prev) return prev;
        const next: QuoteState = { ...prev, ...patch, updatedAt: new Date().toISOString() };
        leadAdapter.saveQuoteProgress(next.sessionId, next);
        return next;
      });
    },
    [leadAdapter]
  );

  const value = useMemo(() => ({ quote, hydrated, updateQuote }), [quote, hydrated, updateQuote]);

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error("useQuote must be used within a QuoteProvider");
  return ctx;
}
