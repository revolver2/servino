export type ApiEnvelope<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export async function apiPost<T = unknown>(
  baseURL: string,
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; json: ApiEnvelope<T> | null }> {
  const res = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  return { status: res.status, json };
}

/**
 * Deterministic fake IP (TEST-NET-2 range, never a real routable address)
 * derived from a seed string — gives each simulated test "customer" its
 * own rate-limit bucket (clientIp() in src/lib/server/rate-limit.ts reads
 * X-Forwarded-For). Without this, admin tests that legitimately submit
 * several real customer funnels in quick succession would collide with
 * each other's shared loopback bucket and trip the real, unmodified
 * `/api/lead/booking-intent` rate limit (10/60s) purely from test volume
 * — not a defect in that limit, which several real distinct customers
 * would never hit.
 */
export function fakeIp(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `198.51.100.${(hash % 250) + 1}`;
}

export async function apiGet<T = unknown>(
  baseURL: string,
  path: string
): Promise<{ status: number; json: ApiEnvelope<T> | null }> {
  const res = await fetch(`${baseURL}${path}`);
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  return { status: res.status, json };
}
