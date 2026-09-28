import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { canStartProject } from '@/lib/billing/entitlement';

/**
 * Read-only view of "can I start another project, and why not?".
 *
 * Backs the /billing usage meter. Deliberately separate from the gate so the UI
 * can show progress without exposing a mutation, and so the same logic that
 * decides a create is the logic that explains it.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [gate, subscription, credits] = await Promise.all([
      canStartProject(user),
      db.subscription.findFirst({
        where: { userId: user.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: {
          tier: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      }),
      db.user.findUnique({
        where: { id: user.id },
        select: { credits: true },
      }),
    ]);

    return NextResponse.json({
      allowed: gate.allowed,
      reason: gate.reason,
      tier: gate.tier ?? subscription?.tier ?? null,
      allowance: gate.allowance ?? null,
      usedThisPeriod: gate.usedThisPeriod ?? 0,
      remaining: gate.remaining ?? null,
      periodStart: subscription?.currentPeriodStart?.toISOString() ?? null,
      periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      credits: credits?.credits ?? 0,
      message: gate.message,
    });
  } catch (error) {
    console.error('GET /api/billing/quota Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
