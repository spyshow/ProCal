import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Per-token rate limiting for the agent surface.
 *
 * `procal_export_report_pdf` and `procal_export_drawings_pdf` each launch a
 * headless Chromium instance. Nothing bounded how often a token holder could ask
 * for one, so a loop — or a mistaken agent retrying — could saturate the serverless
 * function pool and the database at once. Exports therefore get a much tighter
 * budget than ordinary tool calls.
 *
 * The window is stored in Postgres rather than in memory: this runs on Vercel,
 * where each serverless instance has its own heap, so an in-process counter would
 * be reset constantly and limit nothing.
 */

const mocks = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    agentRateLimit: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      create: mocks.create,
    },
  },
}));

const { consumeRateLimit, RATE_LIMITS, checkRateLimit } = await import('./rate-limit');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({});
  mocks.create.mockResolvedValue({});
});

describe('checkRateLimit', () => {
  const now = () => new Date('2026-09-29T12:00:00.000Z');

  it('allows requests inside the budget', async () => {
    mocks.findUnique.mockResolvedValue({ count: 5, windowStart: new Date('2026-09-29T11:59:30.000Z') });

    const result = await checkRateLimit({
      key: 'token-1',
      bucket: 'general',
      now: now(),
    });

    expect(result.allowed).toBe(true);
    // checkRateLimit only inspects; the count is what is currently spent.
    expect(result.remaining).toBe(RATE_LIMITS.general.limit - 5);
  });

  it('blocks once the budget is spent and says how long to wait', async () => {
    mocks.findUnique.mockResolvedValue({ count: RATE_LIMITS.general.limit, windowStart: new Date('2026-09-29T11:59:30.000Z') });

    const result = await checkRateLimit({
      key: 'token-1',
      bucket: 'general',
      now: now(),
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('starts a fresh window when the previous one has expired', async () => {
    // 20 minutes into a 60s window: the old count must not carry over.
    mocks.findUnique.mockResolvedValue({ count: RATE_LIMITS.general.limit, windowStart: new Date('2026-09-29T11:40:00.000Z') });

    const result = await checkRateLimit({
      key: 'token-1',
      bucket: 'general',
      now: now(),
    });

    expect(result.allowed).toBe(true);
  });

  it('gives exports a much tighter budget than ordinary tool calls', () => {
    // Each export spawns a browser; an unbounded loop is a denial-of-service.
    expect(RATE_LIMITS.export.limit).toBeLessThan(RATE_LIMITS.general.limit);
    expect(RATE_LIMITS.export.limit).toBeGreaterThanOrEqual(1);
  });

  it('keys windows per identity, so one token cannot exhaust another', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await consumeRateLimit({ key: 'token-A', bucket: 'general', now: now() });
    await consumeRateLimit({ key: 'token-B', bucket: 'general', now: now() });

    const keyA = mocks.upsert.mock.calls[0][0].where.key;
    const keyB = mocks.upsert.mock.calls[1][0].where.key;
    expect(keyA).not.toBe(keyB);
  });

  it('keeps the export budget separate from the general budget', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await consumeRateLimit({ key: 'token-1', bucket: 'general', now: now() });
    await consumeRateLimit({ key: 'token-1', bucket: 'export', now: now() });

    const keyGeneral = mocks.upsert.mock.calls[0][0].where.key;
    const keyExport = mocks.upsert.mock.calls[1][0].where.key;
    expect(keyGeneral).not.toBe(keyExport);
  });
});

describe('bucketForTool', () => {
  it('charges browser-spawning tools to the tighter export budget', async () => {
    const { bucketForTool } = await import('./rate-limit');
    expect(bucketForTool('procal_export_report_pdf')).toBe('export');
    expect(bucketForTool('procal_export_drawings_pdf')).toBe('export');
    expect(bucketForTool('procal_export_excel')).toBe('export');
  });

  it('charges ordinary tools to the general budget', async () => {
    const { bucketForTool } = await import('./rate-limit');
    expect(bucketForTool('procal_list_projects')).toBe('general');
    expect(bucketForTool('procal_recalculate_project')).toBe('general');
    expect(bucketForTool('procal_create_project_from_spec')).toBe('general');
  });
});

describe('consumeRateLimit', () => {
  const now = () => new Date('2026-09-29T12:00:00.000Z');

  it('increments the counter in the same window', async () => {
    mocks.findUnique.mockResolvedValue({ count: 2, windowStart: new Date('2026-09-29T11:59:40.000Z') });

    const result = await consumeRateLimit({ key: 'token-1', bucket: 'export', now: now() });

    expect(result.allowed).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ count: 3 }) })
    );
  });

  it('writes a new row rather than updating a stale one', async () => {
    mocks.findUnique.mockResolvedValue({ count: 9, windowStart: new Date('2026-09-29T11:00:00.000Z') });

    await consumeRateLimit({ key: 'token-1', bucket: 'general', now: now() });

    expect(mocks.upsert.mock.calls[0][0].update.count).toBe(1);
  });

  it('does not write when the caller is already over budget', async () => {
    mocks.findUnique.mockResolvedValue({ count: 999, windowStart: new Date('2026-09-29T11:59:40.000Z') });

    const result = await consumeRateLimit({ key: 'token-1', bucket: 'general', now: now() });

    expect(result.allowed).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('fails open so a rate-limiter outage cannot block legitimate agents', async () => {
    // Availability beats throttling: the endpoint is authenticated and authorised
    // regardless, so a database blip must not take the MCP surface down with it.
    mocks.findUnique.mockRejectedValue(new Error('db down'));

    const result = await consumeRateLimit({ key: 'token-1', bucket: 'general', now: now() });

    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
  });
});
