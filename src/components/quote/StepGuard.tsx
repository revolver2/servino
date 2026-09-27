"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FunnelStep } from "@/types/quote";
import { useQuote } from "@/lib/quote/quote-provider";
import { firstIncompleteStep, isStepUnlocked, stepRoute } from "@/lib/quote/step-guard";

/**
 * Wrap each step page's content in this so deep-linking or back/forward
 * navigation into a step whose prerequisites aren't met redirects to the
 * right earlier step instead of rendering broken/empty state.
 */
export function StepGuard({ step, children }: { step: FunnelStep; children: ReactNode }) {
  const { quote, hydrated } = useQuote();
  const router = useRouter();

  const unlocked = hydrated && quote ? isStepUnlocked(quote, step) : false;

  useEffect(() => {
    if (!hydrated || !quote) return;
    if (!isStepUnlocked(quote, step)) {
      router.replace(stepRoute(firstIncompleteStep(quote)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, quote, step]);

  if (!hydrated || !quote || !unlocked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ink-muted">Loading your project…</p>
      </div>
    );
  }

  return <>{children}</>;
}
