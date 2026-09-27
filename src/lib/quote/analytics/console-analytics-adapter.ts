import type { AnalyticsAdapter, AnalyticsEvent } from "./analytics-adapter";

/**
 * Development analytics implementation — logs to the browser console.
 * B1 has no real analytics provider wired up; swapping this for a real
 * one (GA4, PostHog, etc.) later is a change to `get-analytics-adapter.ts`
 * only.
 */
export class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  track(event: AnalyticsEvent): void {
    if (process.env.NODE_ENV !== "production") {
      console.info("[analytics]", event.name, event);
    }
  }
}
