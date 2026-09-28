import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { getStripe, getWebhookSecret } from '@/lib/stripe';
import { grantCredits } from '@/lib/billing/entitlement';

/**
 * Stripe webhook (Task 3 Step 4).
 *
 * Idempotency: `CheckoutIntent.stripeSessionId` is unique, and the intent is
 * only moved off PENDING once. Stripe retries deliveries, so the handler must be
 * safe to run many times for the same event — a naive implementation would grant
 * a credit per attempt.
 *
 * Trust: the signature is verified against the raw body before anything is read
 * from it. Nothing in the payload is trusted without that check.
 */

export const dynamic = 'force-dynamic';

type EventType =
  | 'checkout.session.completed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'payment_intent.payment_failed';

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured' },
      { status: 503 }
    );
  }

  // Read the RAW body — signature verification fails on a re-serialised payload.
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // Never leak the reason — it can help an attacker probe the secret.
    console.warn('[stripe] webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Stripe event objects are deeply unioned; the handlers only read a handful of
  // scalar fields, so narrow once here rather than casting in every branch.
  const data = event.data.object as unknown as Record<string, unknown>;
  const type = event.type as EventType;

  try {
    switch (type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(data);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(type, data);
        break;
      default:
        // Unhandled types are acknowledged so Stripe stops retrying them.
        break;
    }
  } catch (error) {
    console.error(`[stripe] webhook handler failed for ${type}:`, error);
    // 500 tells Stripe to retry — correct for a transient database failure.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Stripe metadata arrives as a string map; treat a missing key as ''. */
function meta(obj: Record<string, unknown>, key: string): string {
  const m = obj.metadata as Record<string, string> | undefined | null;
  return typeof m?.[key] === 'string' ? (m[key] as string) : '';
}

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const sessionId = String(session.id);
  const intentId = meta(session, 'intentId') || String(session.client_reference_id ?? '');

  if (!intentId) {
    console.warn('[stripe] checkout.session.completed without an intentId', sessionId);
    return;
  }

  // The unique index on stripeSessionId plus the status check is what makes a
  // duplicate delivery a no-op rather than a second grant.
  const intent = await db.checkoutIntent.findUnique({ where: { id: intentId } });
  if (!intent) {
    console.warn('[stripe] no CheckoutIntent for', intentId);
    return;
  }
  if (intent.status === 'PAID') {
    return; // already processed
  }
  if (intent.stripeSessionId && intent.stripeSessionId !== sessionId) {
    console.warn('[stripe] session id mismatch for intent', intentId);
    return;
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string })?.id ?? null;

  if (intent.kind === 'CREDIT_PACK') {
    await grantCredits({
      userId: intent.userId,
      credits: intent.credits,
      reason: 'PURCHASE',
      stripeSessionId: sessionId,
      note: `Single project pass (${intent.credits} credit${intent.credits === 1 ? '' : 's'})`,
    });
    await db.checkoutIntent.update({
      where: { id: intent.id },
      data: { status: 'PAID', stripeSessionId: sessionId },
    });
    return;
  }

  // SUBSCRIPTION: entitlement lives in the Subscription table, not in credits.
  const stripeSubId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as { id?: string })?.id ?? null;

  const periodStart = readEpoch(session, 'current_period_start');
  const periodEnd = readEpoch(session, 'current_period_end');

  await db.$transaction([
    db.subscription.upsert({
      where: { stripeSubscriptionId: stripeSubId ?? `pending-${intent.id}` },
      create: {
        userId: intent.userId,
        tier: intent.tier ?? 'starter',
        status: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
      update: {
        status: 'active',
        stripeCustomerId: customerId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    }),
    db.checkoutIntent.update({
      where: { id: intent.id },
      data: { status: 'PAID', stripeSessionId: sessionId },
    }),
  ]);
}

async function handleSubscriptionChange(
  type: 'customer.subscription.updated' | 'customer.subscription.deleted',
  sub: Record<string, unknown>,
) {
  const subId = String(sub.id);
  if (!subId) return;

  const status =
    type === 'customer.subscription.deleted'
      ? 'canceled'
      : mapStripeStatus(String(sub.status ?? ''));

  // Renewal moves the period forward, which resets the project allowance. This
  // is the event that must keep currentPeriodStart fresh.
  const periodStart = readEpoch(sub, 'current_period_start');
  const periodEnd = readEpoch(sub, 'current_period_end');

  await db.subscription.updateMany({
    where: { stripeSubscriptionId: subId },
    data: {
      status,
      ...(periodStart ? { currentPeriodStart: periodStart } : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    },
  });
}

/** Map Stripe subscription status onto our three states. */
function mapStripeStatus(stripeStatus: string): 'active' | 'past_due' | 'canceled' {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  return 'canceled';
}

/** Stripe sends period bounds as unix seconds, at either `obj` or `obj.item`. */
function readEpoch(obj: Record<string, unknown>, key: string): Date | null {
  const direct = obj[key];
  if (typeof direct === 'number') return new Date(direct * 1000);
  const nested = (obj as Record<string, Record<string, unknown> | undefined>).item?.[key];
  if (typeof nested === 'number') return new Date(nested * 1000);
  return null;
}
