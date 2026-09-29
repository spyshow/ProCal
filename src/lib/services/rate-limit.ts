import { db } from '@/lib/db';

/**
 * Per-token rate limiting for the agent surface.
 *
 * The MCP endpoint is authenticated and authorised per request, but nothing
 * bounded how *often* a token could be used. That matters most for the export
 * tools: `procal_export_report_pdf` and `procal_export_drawings_pdf` each launch a
 * headless Chromium instance, so a loop or a misbehaving agent retrying could
 * saturate the serverless function pool and the database simultaneously. Exports
 * therefore get a much tighter budget than ordinary tool calls.
 *
 * The window lives in Postgres rather than in process memory because this runs on
 * Vercel, where each serverless instance has its own heap. An in-process counter
 * would reset on every cold start and limit nothing.
 *
 * The limiter **fails open**: if the counter table is unreachable, requests are
 * allowed. Every request is still authenticated and authorised, so a database blip
 * in the limiter should not take the agent surface down with it.
 */

export type RateBucket = 'general' | 'export';

export const RATE_LIMITS: Record<RateBucket, { limit: number; windowSeconds: number }> = {
  // Ordinary reads and small writes.
  general: { limit: 60, windowSeconds: 60 },
  // Each call may spawn a browser, so the budget is deliberately small.
  export: { limit: 6, windowSeconds: 60 },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  /** True when the limiter itself failed and the request was let through. */
  degraded?: boolean;
}

interface StoredWindow {
  count: number;
  windowStart: Date;
}

/**
 * Composite key for one identity within one bucket. Both parts are in the primary
 * key so one noisy token cannot consume another's budget.
 */
function bucketKey(key: string, bucket: RateBucket): string {
  return `${bucket}:${key}`;
}

/**
 * Inspect the current window without consuming from it.
 *
 * Used by the request path to attach limit headers; `consumeRateLimit` is what
 * actually spends budget.
 */
export async function checkRateLimit(params: {
  key: string;
  bucket: RateBucket;
  now?: Date;
}): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[params.bucket];
  const now = params.now ?? new Date();
  const key = bucketKey(params.key, params.bucket);

  try {
    const row = await db.agentRateLimit.findUnique({ where: { key } });
    const windowMs = windowSeconds * 1000;
    const fresh =
      row && now.getTime() - new Date(row.windowStart).getTime() < windowMs ? (row as StoredWindow) : null;
    const count = fresh?.count ?? 0;

    if (count >= limit) {
      const windowEnd = (fresh ? new Date(fresh.windowStart).getTime() : now.getTime()) + windowMs;
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
      };
    }

    return { allowed: true, limit, remaining: limit - count, retryAfterSeconds: 0 };
  } catch (err) {
    console.warn('rate-limit: check failed, allowing request:', err);
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0, degraded: true };
  }
}

/**
 * Spend one unit of budget, or report when the caller is already over.
 *
 * No write happens when the budget is exhausted, so a client that ignores the
 * refusal cannot keep the row climbing.
 */
export async function consumeRateLimit(params: {
  key: string;
  bucket: RateBucket;
  now?: Date;
}): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[params.bucket];
  const now = params.now ?? new Date();
  const key = bucketKey(params.key, params.bucket);
  const windowMs = windowSeconds * 1000;

  try {
    const existing = await db.agentRateLimit.findUnique({ where: { key } });
    const withinWindow =
      existing && now.getTime() - new Date(existing.windowStart).getTime() < windowMs;
    const currentCount = withinWindow ? existing.count : 0;

    if (currentCount >= limit) {
      const windowEnd =
        (withinWindow ? new Date(existing.windowStart).getTime() : now.getTime()) + windowMs;
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
      };
    }

    const nextCount = currentCount + 1;
    await db.agentRateLimit.upsert({
      where: { key },
      create: { key, count: nextCount, windowStart: now, updatedAt: now },
      update: {
        count: nextCount,
        // Reset the window only when the old one has lapsed.
        ...(withinWindow ? {} : { windowStart: now }),
        updatedAt: now,
      },
    });

    return { allowed: true, limit, remaining: limit - nextCount, retryAfterSeconds: 0 };
  } catch (err) {
    console.warn('rate-limit: consume failed, allowing request:', err);
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0, degraded: true };
  }
}

/** Tools that spawn a browser and therefore draw from the tighter budget. */
export const EXPORT_TOOLS = new Set([
  'procal_export_report_pdf',
  'procal_export_excel',
  'procal_export_drawings_pdf',
]);

/** Pick the bucket a tool call should be charged against. */
export function bucketForTool(toolName: string): RateBucket {
  return EXPORT_TOOLS.has(toolName) ? 'export' : 'general';
}
