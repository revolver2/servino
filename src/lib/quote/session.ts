import { readJson, writeJson } from "./storage";

/**
 * Anonymous quote-session identifier.
 *
 * - Generated with crypto.randomUUID() — not sequential, not guessable.
 * - Persisted in localStorage so it survives refresh/navigation within the
 *   same browser.
 * - Purely a correlation key for attaching funnel progress to a future
 *   lead record. It is NOT an authentication token and must never be
 *   treated as proof of identity or used to authorize anything.
 */

const SESSION_KEY = "servino_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    // Server render — caller must re-resolve on the client; this branch
    // only exists so the function is safe to call during SSR without
    // throwing.
    return "";
  }

  const existing = readJson<string>(SESSION_KEY);
  if (existing) return existing;

  const fresh = generateSessionId();
  writeJson(SESSION_KEY, fresh);
  return fresh;
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID — still
  // non-sequential and unguessable enough for a correlation key.
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
