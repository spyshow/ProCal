/**
 * Lightweight in-memory sliding-window rate limiter for abuse-prone routes
 * (login, register, password reset, contact/lead form).
 *
 * Best-effort by design: on serverless multi-instance deployments each
 * instance counts independently, and the map resets on cold start. That still
 * blunts credential-stuffing and mail-relay floods at zero infrastructure
 * cost; swap for Upstash/Redis if per-instance limits become insufficient.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Periodic sweep so idle keys do not accumulate forever. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (!b.hits.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Extracts a best-effort client identity for limiting. Proxy headers are
 * trusted only because this is abuse-mitigation (not authorization); an
 * attacker rotating spoofed X-Forwarded-For values just gets fresh buckets,
 * which degrades to per-instance IP limiting.
 */
export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip =
    fwd.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
