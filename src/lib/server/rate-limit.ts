/**
 * In-memory, single-process rate limiting for public lead endpoints (spec
 * section 32). Fixed-window counter keyed by `${bucket}:${key}`.
 *
 * Known limitation, documented rather than hidden: this only protects a
 * single Node process. A multi-instance production deployment (spec
 * section 73–75 mentions Redis for background/queue work) needs a shared
 * store (Redis `INCR`+`EXPIRE` is the natural fit) for this to hold across
 * instances — noted in docs/SECURITY_MODEL.md as a production requirement,
 * not implemented here to avoid pulling in Redis for a single-VPS B2 MVP.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export function checkRateLimit(
  bucket: string,
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number } {
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const existing = buckets.get(id);

  if (!existing || now - existing.windowStart > config.windowMs) {
    buckets.set(id, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.max - 1 };
  }

  if (existing.count >= config.max) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: config.max - existing.count };
}

/** Best-effort client identifier from request headers — see docs/SECURITY_MODEL.md. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
