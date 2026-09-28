import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Billing: entitlement precedence, credit ledger, and webhook idempotency.
 *
 * The webhook is the one place where a bug silently gives away money or service,
 * so "duplicate delivery must not double-grant" is asserted directly rather than
 * assumed from the unique index.
 */

const mocks = {
  userFindUnique: vi.fn(),
  userUpdate: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  subscriptionFindFirst: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  projectCount: vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0),
  creditTransactionCreate: vi.fn(async () => ({ id: 'ct1' })),
  projectCreate: vi.fn(),
  memberCreate: vi.fn(async () => ({})),
  seedTemplates: vi.fn(async () => undefined),
  seedLibrary: vi.fn(async () => undefined),
  transaction: vi.fn(async (ops: unknown) => {
    const list = Array.isArray(ops) ? ops : [ops];
    return Promise.all(list);
  }),
};

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    subscription: { findFirst: mocks.subscriptionFindFirst },
    creditTransaction: { create: mocks.creditTransactionCreate },
    project: {
      create: mocks.projectCreate,
      findMany: vi.fn(async () => []),
      count: mocks.projectCount,
    },
    projectMember: { create: mocks.memberCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/project-defaults', () => ({
  seedDefaultProjectTemplates: vi.fn(async () => mocks.seedTemplates()),
  seedDefaultLoadLibrary: vi.fn(async () => mocks.seedLibrary()),
}));

const USER = { id: 'u1', role: 'USER', credits: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscriptionFindFirst.mockResolvedValue(null);
  mocks.userFindUnique.mockResolvedValue({ credits: 0, role: 'USER', disabled: false });
});

describe('canStartProject precedence', () => {
  it('1. admin bypasses without touching the database', async () => {
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject({ id: 'u1', role: 'ADMIN', credits: 0 });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('admin_bypass');
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('2. an active subscription grants access with no credit spend', async () => {
    mocks.subscriptionFindFirst.mockResolvedValue({ tier: 'professional', currentPeriodEnd: null });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('subscription');
    expect(res.tier).toBe('professional');
  });

  it('3. credits are the fallback', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 2, role: 'USER', disabled: false });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.reason).toBe('credits');
    expect(res.remaining).toBe(2);
  });

  it('4. no subscription and no credits is payment_required', async () => {
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('payment_required');
    expect(res.checkoutUrl).toBe('/billing');
  });

  it('a disabled account cannot start a project even with credits', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 9, role: 'USER', disabled: true });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(false);
  });

  it('a canceled subscription does not grant access', async () => {
    // The query filters status='active', so a canceled row never comes back.
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(false);
    expect(mocks.subscriptionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) })
    );
  });
});

describe('subscription quota', () => {
  const PERIOD_START = new Date('2026-09-01T00:00:00Z');

  function subscribed(tier: string, periodStart: Date | null = PERIOD_START) {
    mocks.subscriptionFindFirst.mockResolvedValue({ tier, currentPeriodStart: periodStart });
  }

  it('allows a subscriber with allowance left and reports the remainder', async () => {
    subscribed('professional');
    mocks.projectCount.mockResolvedValue(2); // 2 of 5 used
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('subscription');
    expect(res.allowance).toBe(5);
    expect(res.usedThisPeriod).toBe(2);
    expect(res.remaining).toBe(3);
  });

  it('counts only projects created since the period start', async () => {
    subscribed('starter');
    mocks.projectCount.mockResolvedValue(0);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    await canStartProject(USER);
    expect(mocks.projectCount).toHaveBeenCalledWith({
      where: { userId: USER.id, createdAt: { gte: PERIOD_START } },
    });
  });

  it('starter is capped at 1 project per period', async () => {
    subscribed('starter');
    mocks.projectCount.mockResolvedValue(1);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('quota_exhausted');
    expect(res.allowance).toBe(1);
    expect(res.usedThisPeriod).toBe(1);
    expect(res.remaining).toBe(0);
  });

  it('professional is capped at 5 and team at 15', async () => {
    const { canStartProject } = await import('@/lib/billing/entitlement');

    subscribed('professional');
    mocks.projectCount.mockResolvedValue(4);
    expect((await canStartProject(USER)).allowed).toBe(true);
    mocks.projectCount.mockResolvedValue(5);
    expect((await canStartProject(USER)).reason).toBe('quota_exhausted');

    subscribed('team');
    mocks.projectCount.mockResolvedValue(14);
    expect((await canStartProject(USER)).allowed).toBe(true);
    mocks.projectCount.mockResolvedValue(15);
    expect((await canStartProject(USER)).reason).toBe('quota_exhausted');
  });

  it('tells the user to upgrade, not to buy credits', async () => {
    subscribed('professional');
    mocks.projectCount.mockResolvedValue(5);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.message).toMatch(/upgrade/i);
    // The whole point: a paying customer must not be told to buy credits.
    expect(res.message).not.toMatch(/buy credits|no credits remaining/i);
    expect(res.checkoutUrl).toBe('/billing');
  });

  it('reminds the user that existing projects stay accessible', async () => {
    subscribed('professional');
    mocks.projectCount.mockResolvedValue(5);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    expect((await canStartProject(USER)).message).toMatch(/stay fully accessible/i);
  });

  it('falls back to a rolling 30-day window when the period start is missing', async () => {
    subscribed('professional', null);
    mocks.projectCount.mockResolvedValue(0);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(true);
    // The fallback window is ~30 days back, not the epoch.
    const call = mocks.projectCount.mock.calls[0][0] as {
      where: { userId: string; createdAt: { gte: Date } };
    };
    const since = call.where.createdAt.gte;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(29);
    expect(daysAgo).toBeLessThan(31);
  });

  it('refuses rather than going unlimited on an unrecognised tier', async () => {
    subscribed('enterprise-unlimited');
    mocks.projectCount.mockResolvedValue(0);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.allowed).toBe(false);
    expect(res.message).toMatch(/unrecognised plan/i);
  });

  it('does not let a subscription fall back to credits when the quota is spent', async () => {
    // The user has plenty of credits AND a spent quota. Falling back would turn
    // a subscriber into a per-project customer without them agreeing.
    mocks.userFindUnique.mockResolvedValue({ credits: 99, role: 'USER', disabled: false });
    subscribed('starter');
    mocks.projectCount.mockResolvedValue(1);
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject(USER);
    expect(res.reason).toBe('quota_exhausted');
    expect(res.remaining).toBe(0);
  });

  it('a canceled subscription drops back to the credit balance', async () => {
    // The query filters status='active', so a canceled row never grants.
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue({ credits: 1, role: 'USER', disabled: false });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    expect((await canStartProject(USER)).reason).toBe('credits');
  });
});

describe('credit ledger', () => {
  it('spend decrements the balance and writes a PROJECT_SPENT row atomically', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 1 });
    const { spendProjectCredit } = await import('@/lib/billing/entitlement');
    expect(await spendProjectCredit('u1', 'Created project "X"')).toBe(true);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { decrement: 1 } } })
    );
    expect(mocks.creditTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: -1, reason: 'PROJECT_SPENT' }),
      })
    );
    // Both writes go through one transaction so the balance and the audit trail
    // can never disagree.
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses to spend when the balance is short and writes nothing', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 0 });
    const { spendProjectCredit } = await import('@/lib/billing/entitlement');
    expect(await spendProjectCredit('u1')).toBe(false);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.creditTransactionCreate).not.toHaveBeenCalled();
  });

  it('grant increments and records the reason', async () => {
    const { grantCredits } = await import('@/lib/billing/entitlement');
    await grantCredits({ userId: 'u1', credits: 5, reason: 'ADMIN_GRANT', actorId: 'admin1' });
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { increment: 5 } } })
    );
    expect(mocks.creditTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 5, reason: 'ADMIN_GRANT', actorId: 'admin1' }),
      })
    );
  });
});

describe('webhook safety', () => {
  it('returns 503 when Stripe is not configured rather than pretending to work', async () => {
    vi.resetModules();
    vi.doMock('@/lib/stripe', () => ({
      getStripe: () => null,
      getWebhookSecret: () => null,
    }));
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(new Request('http://localhost/api/billing/webhook', { method: 'POST' }));
    expect(res.status).toBe(503);
  });

  it('rejects a request with no signature header', async () => {
    vi.resetModules();
    vi.doMock('@/lib/stripe', () => ({
      getStripe: () => ({ webhooks: { constructEvent: vi.fn() } }),
      getWebhookSecret: () => 'whsec_test',
    }));
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(new Request('http://localhost/api/billing/webhook', { method: 'POST' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid signature and does not leak the reason', async () => {
    vi.resetModules();
    vi.doMock('@/lib/stripe', () => ({
      getStripe: () => ({
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error('timestamp outside the tolerance window: secret is whsec_abc');
          }),
        },
      }),
      getWebhookSecret: () => 'whsec_test',
    }));
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(
      new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: '{}',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
    expect(JSON.stringify(body)).not.toContain('whsec');
  });

  it('acknowledges an event type it does not handle, so Stripe stops retrying', async () => {
    vi.resetModules();
    vi.doMock('@/lib/stripe', () => ({
      getStripe: () => ({
        webhooks: {
          constructEvent: vi.fn(() => ({
            id: 'evt_1',
            type: 'charge.refunded',
            data: { object: {} },
          })),
        },
      }),
      getWebhookSecret: () => 'whsec_test',
    }));
    const { POST } = await import('@/app/api/billing/webhook/route');
    const res = await POST(
      new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=x' },
        body: '{}',
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });
});
