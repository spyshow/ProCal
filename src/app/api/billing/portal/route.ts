import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';

/**
 * Stripe Customer Portal session, so subscribers can change or cancel their plan
 * without support. The redirect URL is fixed to this app's own billing page —
 * accepting it from the request would make this an open redirect.
 */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
    }

    const subscription = await db.subscription.findFirst({
      where: { userId: user.id, status: { in: ['active', 'past_due'] } },
      orderBy: { createdAt: 'desc' },
      select: { stripeCustomerId: true },
    });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription to manage' },
        { status: 404 }
      );
    }

    const origin = process.env.APP_URL;
    if (!origin) {
      console.warn('[stripe] APP_URL is not set; the portal needs a return URL');
      return NextResponse.json(
        { error: 'APP_URL is not configured' },
        { status: 503 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    console.error('POST /api/billing/portal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
