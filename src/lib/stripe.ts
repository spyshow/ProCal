import Stripe from 'stripe';

/**
 * Stripe client (Task 3 Step 4).
 *
 * Returns null when Stripe is not configured, so every caller degrades to the
 * existing manual lead-capture flow instead of 500-ing on a deployment that has
 * no keys. `isBillingConfigured()` is the guard the routes check.
 */

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  // No apiVersion pinned: the SDK's own default tracks the account's API version
  // and avoids a hard failure if that version is retired.
  cached = key ? new Stripe(key) : null;
  if (!cached) {
    console.warn(
      '[stripe] STRIPE_SECRET_KEY is not set — card checkout is disabled. Users fall back to the manual credit loop.'
    );
  }
  return cached;
}

export function isBillingConfigured(): boolean {
  return Boolean(getStripe());
}

/** Webhook signing secret, required for `checkout.session.completed` to be trusted. */
export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// --- Catalogue -------------------------------------------------------------

export type TierKey = 'starter' | 'professional' | 'team';

/**
 * Projects each tier may START per billing period.
 *
 * This is the number the entitlement gate enforces — it lives next to the prices
 * rather than in the UI, so a tier's price and its allowance can never disagree.
 */
export const TIER_PROJECT_ALLOWANCE: Record<TierKey, number> = {
  starter: 1,
  professional: 5,
  team: 15,
};

/** How long a billing period runs, used only for the fallback window. */
export const BILLING_PERIOD_DAYS = 30;

export function isTierKey(v: unknown): v is TierKey {
  return typeof v === 'string' && v in TIER_PROJECT_ALLOWANCE;
}

export function allowanceForTier(tier: string | null | undefined): number | null {
  return isTierKey(tier) ? TIER_PROJECT_ALLOWANCE[tier] : null;
}

/**
 * Products, per docs/ideas/pricing-strategy.md §4.1.
 *
 * The single-project pass is priced ABOVE the entry tier on purpose: it is the
 * escape hatch for people who refuse subscriptions, not a cheaper way to buy a
 * project. A $30 pass would make Starter ($29) pointless and remove any reason
 * to subscribe.
 */
export const TIERS = {
  starter: {
    key: 'starter' as const,
    label: 'Starter',
    monthlyAmountCents: 2900,
    annualAmountCents: 27840, // $24/mo billed annually
    projectsPerMonth: 1,
    seats: 1,
  },
  professional: {
    key: 'professional' as const,
    label: 'Professional',
    monthlyAmountCents: 8900,
    annualAmountCents: 71040, // $74/mo billed annually
    projectsPerMonth: 5,
    seats: 2,
  },
  team: {
    key: 'team' as const,
    label: 'Team',
    monthlyAmountCents: 24900,
    annualAmountCents: 199200, // $199/mo billed annually
    projectsPerMonth: 15,
    seats: 5,
  },
} satisfies Record<TierKey, {
  key: TierKey;
  label: string;
  monthlyAmountCents: number;
  annualAmountCents: number;
  projectsPerMonth: number;
  seats: number;
}>;

export const PROJECT_PASS = {
  key: 'single_project_pass' as const,
  label: 'Single Project Pass',
  amountCents: 4900,
  credits: 1,
};

/** Stripe price id overrides, so live keys can point at pre-created prices. */
export const PRICE_IDS: Record<string, string | undefined> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
  professional_annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  team_monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
  team_annual: process.env.STRIPE_PRICE_TEAM_ANNUAL,
  single_project_pass: process.env.STRIPE_PRICE_SINGLE_PROJECT_PASS,
};

export type ProductKey =
  | 'starter_monthly'
  | 'starter_annual'
  | 'professional_monthly'
  | 'professional_annual'
  | 'team_monthly'
  | 'team_annual'
  | 'single_project_pass';

export function isProductKey(v: unknown): v is ProductKey {
  return typeof v === 'string' && v in PRICE_IDS;
}

/** Human-facing catalogue for the billing UI. */
export function productCatalogue() {
  return {
    tiers: Object.values(TIERS).map((t) => ({
      key: t.key,
      label: t.label,
      monthlyAmountCents: t.monthlyAmountCents,
      annualMonthlyAmountCents: Math.round(t.annualAmountCents / 12),
      projectsPerMonth: t.projectsPerMonth,
      seats: t.seats,
      extraSeatAmountCents: 3900,
    })),
    pass: {
      key: PROJECT_PASS.key,
      label: PROJECT_PASS.label,
      amountCents: PROJECT_PASS.amountCents,
      credits: PROJECT_PASS.credits,
    },
  };
}
