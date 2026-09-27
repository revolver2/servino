"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuote } from "@/lib/quote/quote-provider";
import { getEnabledServices } from "@/lib/services-data";
import { resolveServiceability } from "@/lib/quote/locations";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { isStyleValidForService } from "@/lib/quote/style-taxonomy";

const services = getEnabledServices();
const cardAccents = ["bg-purple-light", "bg-coral-light", "bg-teal-light", "bg-purple-light"];

/**
 * A service card click (Homepage/Toronto landing) carries the clicked
 * service as `?service=<slug>` (see src/components/home/Services.tsx).
 * That explicit, just-clicked selection must win over whatever service a
 * stale/previous session already had stored — otherwise a visitor who
 * clicks "Wallpaper" with an old "Wall Panels" session silently keeps
 * seeing Wall Panels preselected. Read directly from the URL (not
 * `useSearchParams()`) so this component doesn't need a Suspense
 * boundary — it's already gated behind StepGuard's hydration check, so
 * `window` is always available by the time it mounts.
 */
function getRequestedServiceSlug(): string | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("service");
  return requested && services.some((s) => s.slug === requested) ? requested : null;
}

export function ProjectLocationStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();

  const [serviceSlug, setServiceSlug] = useState<string | null>(
    () => getRequestedServiceSlug() ?? quote?.serviceSlug ?? null
  );
  const [postalCode, setPostalCode] = useState(quote?.location.postalCode ?? "");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  if (!quote) return null;

  function handleSelectService(slug: string) {
    setServiceSlug(slug);
    analytics.track({ name: "service_selected", serviceSlug: slug });
  }

  function handleContinue() {
    setTouched(true);

    if (!serviceSlug) return;

    const result = resolveServiceability(postalCode);
    if (!result.valid) {
      setLocationError("Enter a valid Canadian postal code (e.g. M5V 2T6).");
      return;
    }
    if (!result.serviceable) {
      setLocationError("Servino isn't available in this area yet — we're starting in Toronto.");
      return;
    }

    setLocationError(null);
    // A style chosen for a previous service (e.g. "Light Oak" for Wall
    // Panels) is meaningless for a different one (e.g. Wallpaper) — clear
    // it the moment the service actually changes, rather than letting a
    // stale, service-inappropriate style silently ride along to Price/
    // Confirmation. Preserved as-is if the new service still supports it.
    const styleStillValid = isStyleValidForService(quote!.style, serviceSlug);
    updateQuote({
      serviceSlug,
      location: { postalCode: postalCode.trim().toUpperCase(), citySlug: result.citySlug, serviceable: true },
      ...(styleStillValid ? {} : { style: null }),
    });
    analytics.track({ name: "location_completed", citySlug: result.citySlug });
    router.push("/quote/measurements");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Let&apos;s start with your project
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {services.map((service, i) => {
          const selected = serviceSlug === service.slug;
          return (
            <button
              key={service.slug}
              type="button"
              onClick={() => handleSelectService(service.slug)}
              aria-pressed={selected}
              className={`relative rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? "border-purple bg-purple-light shadow-sm"
                  : "border-border bg-white hover:border-ink/20 motion-safe:hover:-translate-y-0.5"
              }`}
            >
              {selected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-purple text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <div className={`h-10 w-10 rounded-lg ${cardAccents[i % cardAccents.length]}`} />
              <p className="mt-3 text-sm font-semibold text-ink">{service.name}</p>
            </button>
          );
        })}
      </div>
      {touched && !serviceSlug && (
        <p className="mt-2 text-sm text-coral-text">Choose a project to continue.</p>
      )}

      <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">Where is the project?</h2>
      <p className="mt-1 text-sm text-ink-muted">Servino currently serves Toronto, Ontario.</p>

      <div className="mt-4">
        <label htmlFor="postal-code" className="block text-sm font-medium text-ink">
          Postal code
        </label>
        <input
          id="postal-code"
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          placeholder="M5V 2T6"
          value={postalCode}
          onChange={(e) => {
            setPostalCode(e.target.value);
            setLocationError(null);
          }}
          className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
          aria-invalid={Boolean(locationError)}
          aria-describedby={locationError ? "postal-code-error" : undefined}
        />
        {locationError && (
          <p id="postal-code-error" className="mt-2 text-sm text-coral-text">
            {locationError}
          </p>
        )}
      </div>

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
