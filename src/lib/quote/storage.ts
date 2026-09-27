/**
 * Thin localStorage wrapper shared by session/attribution/quote-progress
 * persistence. Client-only — every caller must guard for `typeof window`.
 */

export function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or inaccessible storage (private browsing, quota, etc.) —
    // treat as absent rather than throwing.
    return null;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable/full — funnel still works in-memory for this
    // page load, it just won't survive a refresh. Not fatal.
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isStale(updatedAtIso: string, ttlMs: number): boolean {
  const updatedAt = new Date(updatedAtIso).getTime();
  if (Number.isNaN(updatedAt)) return true;
  return Date.now() - updatedAt > ttlMs;
}
