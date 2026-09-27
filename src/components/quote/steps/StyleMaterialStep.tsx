"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MaterialOwnership, StyleId } from "@/types/quote";
import { useQuote } from "@/lib/quote/quote-provider";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { getStylesForService, isStyleValidForService } from "@/lib/quote/style-taxonomy";

const materialOptions: { id: MaterialOwnership; title: string; subtitle: string }[] = [
  { id: "INSTALL_ONLY", title: "I already have it", subtitle: "Installation only" },
  { id: "MATERIAL_AND_INSTALL", title: "I need material + installation", subtitle: "We'll include both in your price" },
];

export function StyleMaterialStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();

  const styles = getStylesForService(quote?.serviceSlug);

  // Defense in depth: even if `style` somehow carries a value that isn't
  // valid for the current service (e.g. an older QuoteState shape, or a
  // code path that changed serviceSlug without going through
  // ProjectLocationStep's own clearing logic), never initialize this
  // step already showing an invalid selection.
  const [style, setStyle] = useState<StyleId | null>(() =>
    isStyleValidForService(quote?.style ?? null, quote?.serviceSlug ?? null) ? quote?.style ?? null : null
  );
  const [materialOwnership, setMaterialOwnership] = useState<MaterialOwnership | null>(
    quote?.materialOwnership ?? null
  );
  const [touched, setTouched] = useState(false);

  if (!quote) return null;

  function handleSelectStyle(id: StyleId) {
    setStyle(id);
    analytics.track({ name: "style_selected", styleId: id });
  }

  function handleSelectMaterial(id: MaterialOwnership) {
    setMaterialOwnership(id);
    analytics.track({ name: "material_ownership_selected", materialOwnership: id });
  }

  function handleContinue() {
    setTouched(true);
    if (!style || !materialOwnership) return;
    updateQuote({ style, materialOwnership });
    router.push("/quote/price");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Choose your look</h1>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {styles.map((s) => {
          const selected = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectStyle(s.id)}
              aria-pressed={selected}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={`relative aspect-square w-full rounded-2xl transition-all motion-safe:hover:-translate-y-0.5 ${s.swatchClassName} ${
                  selected ? "ring-2 ring-purple ring-offset-2" : ""
                }`}
              >
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-purple text-white shadow-sm">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </span>
              <span className={`text-xs font-medium ${selected ? "font-semibold text-ink" : "text-ink-muted"}`}>
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      {touched && !style && <p className="mt-2 text-sm text-coral-text">Choose a style to continue.</p>}

      <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">
        Do you already have the material?
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {materialOptions.map((option) => {
          const selected = materialOwnership === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectMaterial(option.id)}
              aria-pressed={selected}
              className={`flex items-start gap-3 rounded-2xl border p-5 text-left transition-all ${
                selected
                  ? "border-purple bg-purple-light shadow-sm"
                  : "border-border bg-white hover:border-ink/20 motion-safe:hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-purple bg-purple" : "border-border bg-white"
                }`}
              >
                {selected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span>
                <p className="text-base font-semibold text-ink">{option.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{option.subtitle}</p>
              </span>
            </button>
          );
        })}
      </div>
      {touched && !materialOwnership && (
        <p className="mt-2 text-sm text-coral-text">Choose an option to continue.</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark sm:w-auto"
      >
        Continue
      </button>
    </div>
  );
}
