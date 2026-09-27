import type { Page } from "@playwright/test";

/** The session id is JSON-stringified in localStorage — see src/lib/quote/storage.ts. */
export async function getSessionId(page: Page): Promise<string> {
  const raw = await page.evaluate(() => localStorage.getItem("servino_session_id"));
  if (!raw) throw new Error("No session id found in localStorage — did the funnel actually start?");
  return JSON.parse(raw) as string;
}
