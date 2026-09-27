"use client";

import { useEffect } from "react";
import { captureAttributionOnce } from "@/lib/quote/attribution";

/**
 * Mounted once in the root layout so first-touch attribution is captured
 * on whichever page a visitor actually lands on (homepage, paid landing
 * page, or a deep link straight into the funnel) — not just the homepage.
 * Renders nothing; side-effect only.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttributionOnce();
  }, []);

  return null;
}
