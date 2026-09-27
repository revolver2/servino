import type { Attribution } from "@/types/quote";
import { readJson, writeJson } from "./storage";

/**
 * First-touch attribution capture.
 *
 * - Reads UTM params + referrer + landing route on the first page a
 *   visitor lands on.
 * - Stored once in localStorage and never overwritten by later visits —
 *   that's what makes it "first-touch" rather than "last-touch".
 * - No PII: only marketing/routing metadata, never name/email/phone/IP.
 */

const ATTRIBUTION_KEY = "servino_attribution";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function captureAttributionOnce(): Attribution {
  const existing = readJson<Attribution>(ATTRIBUTION_KEY);
  if (existing) return existing;

  const attribution = buildAttributionFromCurrentPage();
  writeJson(ATTRIBUTION_KEY, attribution);
  return attribution;
}

export function getStoredAttribution(): Attribution | null {
  return readJson<Attribution>(ATTRIBUTION_KEY);
}

function buildAttributionFromCurrentPage(): Attribution {
  if (typeof window === "undefined") {
    return emptyAttribution("/");
  }

  const params = new URLSearchParams(window.location.search);
  const [utmSource, utmMedium, utmCampaign, utmContent, utmTerm] = UTM_PARAMS.map(
    (key) => params.get(key)
  );

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    landingRoute: window.location.pathname,
    referrer: document.referrer || null,
    firstTouchAt: new Date().toISOString(),
  };
}

function emptyAttribution(landingRoute: string): Attribution {
  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    landingRoute,
    referrer: null,
    firstTouchAt: new Date().toISOString(),
  };
}
