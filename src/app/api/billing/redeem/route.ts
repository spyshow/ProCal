import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { grantCredits } from '@/lib/billing/entitlement';

/**
 * Redeem a promotional code for project credits.
 *
 * The redemption counter is incremented in the same transaction as the grant, and
 * the update is conditioned on `redemptions < maxRedemptions`, so two concurrent
 * redemptions of the last remaining use cannot both succeed.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const promo = await db.promoCode.findUnique({
      where: { code },
      select: { id: true, code: true, credits: true, redemptions: true, maxRedemptions: true, expiresAt: true, active: true },
    });
    if (!promo) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
    }
    if (!promo.active) {
      return NextResponse.json({ error: 'This code is no longer active' }, { status: 400 });
    }
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This code has expired' }, { status: 400 });
    }
    if (promo.redemptions >= promo.maxRedemptions) {
      return NextResponse.json({ error: 'This code has been fully redeemed' }, { status: 400 });
    }

    // Conditional increment: the `lt` filter makes the last redemption a race
    // that only one caller can win.
    const claimed = await db.promoCode.updateMany({
      where: { id: promo.id, redemptions: { lt: promo.maxRedemptions } },
      data: { redemptions: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'This code was just fully redeemed' },
        { status: 409 }
      );
    }

    await grantCredits({
      userId: user.id,
      credits: promo.credits,
      reason: 'PROMO',
      promoCodeId: promo.id,
      note: `Redeemed code ${promo.code}`,
    });

    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { credits: true },
    });

    return NextResponse.json({
      success: true,
      creditsAdded: promo.credits,
      credits: fresh?.credits ?? null,
    });
  } catch (error) {
    console.error('POST /api/billing/redeem Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** Credit ledger for the current user. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [transactions, subscription] = await Promise.all([
      db.creditTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, delta: true, reason: true, note: true, createdAt: true,
        },
      }),
      db.subscription.findFirst({
        where: { userId: user.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { tier: true, status: true, currentPeriodEnd: true },
      }),
    ]);

    return NextResponse.json({
      credits: user.credits,
      subscription,
      transactions: transactions.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error('GET /api/billing/redeem Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
