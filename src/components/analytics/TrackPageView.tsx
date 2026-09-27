"use client";

import { useEffect, useRef } from "react";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import type { AnalyticsEvent } from "@/lib/quote/analytics/analytics-adapter";

/**
 * Fires a single analytics event on mount. Renders nothing.
 * Guards with a ref (not just an empty dependency array) because
 * React StrictMode's dev-only double-invoke would otherwise fire the
 * event twice on every real page load.
 */
export function TrackPageView({ event }: { event: AnalyticsEvent }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    getAnalyticsAdapter().track(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
