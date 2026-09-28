import { db } from '@/lib/db';
import {
  allowanceForTier,
  BILLING_PERIOD_DAYS,
} from '@/lib/stripe';

/**
 * "May this user start a new project?" — the single gate (Task 3 Step 3).
 *
 * Extracted because the rule lived inline in `POST /api/projects` at two
 * separate places (the 402 check and the decrement transaction). With the HTTP
 * route and the MCP `create_project_from_spec` tool both asking, a single
 * implementation is the only way to stop them drifting apart.
 *
 * Entitlement semantics, per `docs/ideas/pricing-strategy.md` §5: **the quota
 * gates project creation, not project existence.** Once a project is created it
 * stays accessible forever. That is also what stops an MCP agent from being
 * locked out of a half-built project it is still working on.
 *
 * Precedence: admin → active subscription → credits.
 */

export interface EntitlementResult {
  allowed: boolean;
  reason?: 'admin_bypass' | 'subscription' | 'credits' | 'payment_required' | 'quota_exhausted';
  /** Which subscription tier granted access, when it did. */
  tier?: string;
  /** Project capacity remaining this billing period, when known. */
  remaining?: number;
  /** The allowance the decision was measured against, for messaging. */
  allowance?: number;
  /** Projects already started this period, for messaging. */
  usedThisPeriod?: number;
  /** Where the user should go to buy more, when blocked. */
  checkoutUrl?: string;
  message?: string;
}

export interface EntitlementUser {
  id: string;
  role: string;
  credits: number;
}

export type CreditReason =
  | 'PURCHASE'
  | 'PROMO'
  | 'ADMIN_GRANT'
  | 'ADMIN_ADJUST'
  | 'PROJECT_SPENT';

/**
 * A subscription grant, and the period it is measured over.
 *
 * `projectCount` is deliberately NOT included: it is computed by the caller
 * against `periodStart` so the count and the start are guaranteed to be
 * consistent with one another.
 */
interface SubscriptionGrant {
  tier: string;
  periodStart: Date | null;
}

async function loadSubscriptionGrant(userId: string): Promise<SubscriptionGrant | null> {
  const sub = await db.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { tier: true, currentPeriodStart: true },
  });
  if (!sub) return null;
  return { tier: sub.tier, periodStart: sub.currentPeriodStart ?? null };
}

/**
 * Projects the caller has STARTED since `since`.
 *
 * This is the count the allowance applies to. Per the entitlement semantics the
 * quota gates *creation*, so a project that existed before the period began is
 * still fully accessible — it just doesn't consume allowance.
 */
export async function projectsStartedSince(
  userId: string,
  since: Date
): Promise<number> {
  return db.project.count({ where: { userId, createdAt: { gte: since } } });
}

export async function canStartProject(user: EntitlementUser): Promise<EntitlementResult> {
  // Admins manage the system and are never gated.
  if (user.role === 'ADMIN') {
    return { allowed: true, reason: 'admin_bypass' };
  }

  // Re-read rather than trusting a claim that may be stale in a token payload or
  // a long-lived context.
  const [fresh, grant] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { credits: true, role: true, disabled: true },
    }),
    loadSubscriptionGrant(user.id),
  ]);

  if (!fresh || fresh.disabled) {
    return {
      allowed: false,
      reason: 'payment_required',
      message: 'Account not found or disabled.',
    };
  }

  if (grant) {
    return evaluateSubscription(user.id, grant);
  }

  if (fresh.credits >= 1) {
    return { allowed: true, reason: 'credits', remaining: fresh.credits };
  }

  return {
    allowed: false,
    reason: 'payment_required',
    remaining: 0,
    checkoutUrl: '/billing',
    message:
      'No project credits remaining. This account needs a subscription or one project credit to create a new project.',
  };
}

/**
 * Apply a subscription's per-period project allowance.
 *
 * A subscriber with quota left creates freely. A subscriber who has used their
 * allowance is refused rather than silently charged, and is told to upgrade or
 * buy a pass — falling back to credits here would quietly turn a $89 subscriber
 * into a per-project customer without them agreeing to it.
 */
async function evaluateSubscription(
  userId: string,
  grant: SubscriptionGrant
): Promise<EntitlementResult> {
  const allowance = allowanceForTier(grant.tier);

  // An unrecognised tier (data drift, a hand-edited row) must not silently
  // become unlimited. Refusing is the safe default: it is visible and fixable.
  if (allowance === null) {
    console.warn(
      `[entitlement] subscription for user ${userId} has unknown tier "${grant.tier}"; refusing project creation.`
    );
    return {
      allowed: false,
      reason: 'payment_required',
      message:
        'This subscription has an unrecognised plan. Please contact support so it can be corrected.',
    };
  }

  // Fall back to a rolling 30-day window when the period start is missing, so a
  // subscriber is never locked out by our own bookkeeping. Approximate, but it
  // still enforces roughly the right allowance instead of none.
  const periodStart =
    grant.periodStart ?? new Date(Date.now() - BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  if (!grant.periodStart) {
    console.warn(
      `[entitlement] subscription for user ${userId} has no currentPeriodStart; using a ${BILLING_PERIOD_DAYS}-day rolling window.`
    );
  }

  const used = await projectsStartedSince(userId, periodStart);
  const remaining = Math.max(0, allowance - used);

  if (remaining === 0) {
    return {
      allowed: false,
      reason: 'quota_exhausted',
      tier: grant.tier,
      allowance,
      usedThisPeriod: used,
      remaining: 0,
      checkoutUrl: '/billing',
      message:
        `The ${grant.tier} plan includes ${allowance} project${allowance === 1 ? '' : 's'} per month, ` +
        `and all ${allowance} have been started. Existing projects stay fully accessible. ` +
        'Upgrade your plan or buy a single project pass to start another.',
    };
  }

  return {
    allowed: true,
    reason: 'subscription',
    tier: grant.tier,
    allowance,
    usedThisPeriod: used,
    remaining,
  };
}

/** Write a ledger row. Every credit movement goes through a helper below. */
export async function recordCreditTransaction(params: {
  userId: string;
  delta: number;
  reason: CreditReason;
  stripeSessionId?: string | null;
  promoCodeId?: string | null;
  actorId?: string | null;
  note?: string | null;
}): Promise<void> {
  await db.creditTransaction.create({
    data: {
      userId: params.userId,
      delta: params.delta,
      reason: params.reason,
      stripeSessionId: params.stripeSessionId ?? null,
      promoCodeId: params.promoCodeId ?? null,
      actorId: params.actorId ?? null,
      note: params.note ?? null,
    },
  });
}

/**
 * Spend one credit. Returns false when the balance is short so callers can turn
 * that into a 402 / `payment_required` instead of discovering it at commit time.
 * The ledger row is written in the same transaction as the decrement, so the two
 * can never disagree.
 */
export async function spendProjectCredit(
  userId: string,
  note?: string
): Promise<boolean> {
  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!fresh || fresh.credits < 1) return false;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { decrement: 1 } },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        delta: -1,
        reason: 'PROJECT_SPENT',
        note: note ?? 'Project created',
      },
    }),
  ]);
  return true;
}

/** Grant credits and record why. Used by the webhook, promo redemption and admin. */
export async function grantCredits(params: {
  userId: string;
  credits: number;
  reason: 'PURCHASE' | 'PROMO' | 'ADMIN_GRANT' | 'ADMIN_ADJUST';
  stripeSessionId?: string | null;
  promoCodeId?: string | null;
  actorId?: string | null;
  note?: string | null;
}): Promise<void> {
  await db.$transaction([
    db.user.update({
      where: { id: params.userId },
      data: { credits: { increment: params.credits } },
    }),
    db.creditTransaction.create({
      data: {
        userId: params.userId,
        delta: params.credits,
        reason: params.reason,
        stripeSessionId: params.stripeSessionId ?? null,
        promoCodeId: params.promoCodeId ?? null,
        actorId: params.actorId ?? null,
        note: params.note ?? null,
      },
    }),
  ]);
}
