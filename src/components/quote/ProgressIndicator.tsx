"use client";

import { useRouter } from "next/navigation";
import { FUNNEL_STEPS, type FunnelStep } from "@/types/quote";

const STEP_LABELS: Record<FunnelStep, string> = {
  project: "Project",
  measurements: "Measurements",
  photo: "Photo",
  style: "Style",
  price: "Price",
  contact: "Contact",
  timing: "Timing",
};

export function ProgressIndicator({ step }: { step: FunnelStep }) {
  const router = useRouter();
  const index = FUNNEL_STEPS.indexOf(step);
  const stepNumber = index + 1;
  const total = FUNNEL_STEPS.length;

  return (
    <div className="border-b border-border bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={index === 0}
          aria-label="Go back"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-offwhite hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex-1">
          <div
            className="flex h-1.5 gap-1.5"
            role="progressbar"
            aria-label="Quote progress"
            aria-valuenow={stepNumber}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuetext={`Step ${stepNumber} of ${total}: ${STEP_LABELS[step]}`}
          >
            {FUNNEL_STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                  i <= index ? "bg-purple" : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs font-medium text-ink-muted">
            Step {stepNumber} of {total} · {STEP_LABELS[step]}
          </p>
        </div>
      </div>
    </div>
  );
}
