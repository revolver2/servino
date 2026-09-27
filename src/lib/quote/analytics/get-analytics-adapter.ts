import type { AnalyticsAdapter } from "./analytics-adapter";
import { ConsoleAnalyticsAdapter } from "./console-analytics-adapter";

let instance: AnalyticsAdapter | null = null;

export function getAnalyticsAdapter(): AnalyticsAdapter {
  if (!instance) instance = new ConsoleAnalyticsAdapter();
  return instance;
}
