import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  getStripe,
  isProductKey,
  PRICE_IDS,
  PROJECT_PASS,
  TIERS,
  type ProductKey,
} from '@/lib/stripe';

/**
 * Create a Stripe Checkout session (Task 3 Step 4).
 *
 * A `CheckoutIntent` row is written first and its id travels in the session
 * metadata. The webhook grants the entitlement from that row, so Stripe's
 * retries are idempotent and an agent's stored project spec survives the payment
 * round-trip.
 *
 * Cookie-authenticated. An MCP agent gets the session URL back and hands it to
 * the user; the user completes payment in the browser.
 */

const bodySchema = z.object({
  product: z.string().refine(isProductKey, 'Unknown product'),
  projectSpec: z.record(z.string(), z.unknown()).optional(),
  successPath: z.string().regex(/^\/(?!\/)/, 'successPath must be a local path').default('/dashboard'),
});

const INTENT_TTL_HOURS = 24;

/**
 * Resolve a catalogue key to a checkout line item: a pre-created Stripe price
 * when one is configured, otherwise an inline `price_data` so the catalogue is
 * usable before anyone creates prices in the dashboard.
 */
function buildLineItem(args: {
  productKey: ProductKey;
  isPass: boolean;
  tier: (typeof TIERS)[keyof typeof TIERS] | null;
  annual: boolean;
}): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = PRICE_IDS[args.productKey];
  if (priceId) return { price: priceId, quantity: 1 };

  if (args.isPass) {
    return {
      price_data: {
        currency: 'usd',
        unit_amount: PROJECT_PASS.amountCents,
        product_data: {
          name: PROJECT_PASS.label,
          description: 'One project, one user, every paid feature. No subscription.',
        },
      },
      quantity: 1,
    };
  }

  const tier = args.tier!;
  return {
    price_data: {
      currency: 'usd',
      unit_amount: args.annual ? tier.annualAmountCents : tier.monthlyAmountCents,
      ...(args.annual ? { recurring: { interval: 'year' as const } } : {}),
      product_data: {
        name: `ProCal ${tier.label}`,
        description: `${tier.projectsPerMonth} project${
          tier.projectsPerMonth === 1 ? '' : 's'
        }/month · ${tier.seats} seat${tier.seats === 1 ? '' : 's'} included`,
      },
    },
    quantity: 1,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { projectSpec, successPath } = parsed.data;
    const productKey = parsed.data.product as ProductKey;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Card checkout is not enabled on this deployment',
          fallback: '/billing',
          message:
            'Ask the support team to grant credits, or set STRIPE_SECRET_KEY to enable checkout.',
        },
        { status: 503 }
      );
    }

    const isPass = productKey === PROJECT_PASS.key;
    const tierKey = isPass ? null : (productKey.split('_')[0] as keyof typeof TIERS);
    const tier = tierKey ? TIERS[tierKey] : null;
    if (!isPass && !tier) {
      return NextResponse.json({ error: `Unknown tier "${String(tierKey)}"` }, { status: 400 });
    }
    const annual = productKey.endsWith('_annual');

    const intent = await db.checkoutIntent.create({
      data: {
        userId: user.id,
        kind: isPass ? 'CREDIT_PACK' : 'SUBSCRIPTION',
        tier: tierKey,
        credits: isPass ? PROJECT_PASS.credits : 0,
        specJson: projectSpec ? JSON.stringify(projectSpec) : null,
        expiresAt: new Date(Date.now() + INTENT_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    // Prefer a pre-created Stripe price; otherwise build one inline so the
    // catalogue works before anyone creates prices in the dashboard.
    const lineItem = buildLineItem({ productKey, isPass, tier, annual });

    const mode: Stripe.Checkout.SessionCreateParams.Mode = isPass ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [lineItem],
      customer_email: user.email ?? undefined,
      client_reference_id: intent.id,
      success_url: `${new URL(request.url).origin}${successPath}?checkout=success`,
      cancel_url: `${new URL(request.url).origin}/billing?checkout=canceled`,
      // Only ids we need back — no email, no PII.
      metadata: {
        intentId: intent.id,
        userId: user.id,
        kind: intent.kind,
        tier: intent.tier ?? '',
      },
      ...(mode === 'subscription' && tierKey
        ? {
            subscription_data: {
              metadata: { intentId: intent.id, userId: user.id, tier: tierKey },
            },
          }
        : {}),
    });

    await db.checkoutIntent.update({
      where: { id: intent.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      intentId: intent.id,
      product: productKey,
      kind: intent.kind,
    });
  } catch (error) {
    console.error('POST /api/billing/checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
