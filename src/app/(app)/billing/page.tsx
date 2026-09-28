'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';
import { Check, CreditCard, Loader2, Ticket, ExternalLink } from 'lucide-react';

const INPUT =
  'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 w-full';

type TierKey = 'starter' | 'professional' | 'team';

interface Ledger {
  credits: number;
  subscription: { tier: TierKey; status: string; currentPeriodEnd: string | null } | null;
  transactions: Array<{
    id: string;
    delta: number;
    reason: string;
    note: string | null;
    createdAt: string;
  }>;
}

const CATALOGUE: Array<{
  key: TierKey;
  label: string;
  monthly: number;
  annualMonthly: number;
  projects: number;
  seats: number;
}> = [
  { key: 'starter', label: 'Starter', monthly: 29, annualMonthly: 24, projects: 1, seats: 1 },
  { key: 'professional', label: 'Professional', monthly: 89, annualMonthly: 74, projects: 5, seats: 2 },
  { key: 'team', label: 'Team', monthly: 249, annualMonthly: 199, projects: 15, seats: 5 },
];

const REASON_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase',
  PROMO: 'Promo code',
  ADMIN_GRANT: 'Granted by admin',
  ADMIN_ADJUST: 'Adjusted by admin',
  PROJECT_SPENT: 'Project created',
};

/** Per-period project allowance, mirroring TIER_PROJECT_ALLOWANCE. */
type Quota = {
  allowed: boolean;
  reason: string;
  tier: string | null;
  allowance: number | null;
  usedThisPeriod: number;
  remaining: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  message?: string;
};

/**
 * /billing — subscription-first (docs/ideas/pricing-strategy.md §4).
 *
 * Primary path is Stripe Checkout. The captured-lead form from the old
 * credit-only flow is kept as a labelled fallback, because Stripe is not
 * configured on every deployment and an engineer who cannot pay still needs a
 * way to ask for credits.
 */
export default function BillingPage() {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const { t } = useTranslation();

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [annual, setAnnual] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState<boolean | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Fallback lead-form state
  const [hasOpen, setHasOpen] = useState(false);
  const [form, setForm] = useState({ email: '', message: '', requestedCredits: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Declared before the effect below, which calls it on mount.
  const loadQuota = async () => {
    try {
      const res = await fetch('/api/billing/quota', { cache: 'no-store' });
      if (res.ok) setQuota(await res.json());
    } catch {
      // Quota is advisory in the UI; a failure must not break the page.
    }
  };

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, email: user.email ?? '' }));

    fetch('/api/billing/redeem', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setLedger(d);
      })
      .catch(() => undefined);

    // Per-period project allowance, so the user can see what is left.
    void loadQuota();

    // Whether an OPEN lead already exists, for the fallback form.
    fetch('/api/contact', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { hasOpen: false }))
      .then((d) => setHasOpen(Boolean(d.hasOpen)))
      .catch(() => undefined);

    // Probe checkout availability with a deliberately invalid product: 400 means
    // Stripe is wired, 503 means it is not. No charge, no session.
    fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: '__probe__' }),
    })
      .then((r) => setCheckoutEnabled(r.status !== 503))
      .catch(() => setCheckoutEnabled(false));
  }, [user]);

  useEffect(() => {
    if (user?.role === 'ADMIN') router.push('/admin/users');
  }, [user, router]);

  if (user?.role === 'ADMIN') {
    return <div className="p-6 text-gray-500">Redirecting…</div>;
  }

  const startCheckout = async (product: string) => {
    setBusy(product);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not start checkout.');
        return;
      }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not open the billing portal.');
        return;
      }
      if (data.portalUrl) window.location.href = data.portalUrl;
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPortalBusy(false);
    }
  };

  const redeem = async () => {
    if (!promoCode.trim()) return;
    setBusy('promo');
    setPromoMsg(null);
    try {
      const res = await fetch('/api/billing/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPromoMsg({ ok: false, text: data?.error || 'Could not redeem that code.' });
        return;
      }
      setPromoMsg({
        ok: true,
        text: `Added ${data.creditsAdded} credit${data.creditsAdded === 1 ? '' : 's'}.`,
      });
      setPromoCode('');
      await refreshUser();
      const fresh = await fetch('/api/billing/redeem', { cache: 'no-store' }).then((r) => r.json());
      setLedger(fresh);
    } catch {
      setPromoMsg({ ok: false, text: 'Unable to reach the server.' });
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('A valid email is required.');
      return;
    }
    if (!form.message.trim()) {
      setError('Please describe what you need credits for.');
      return;
    }
    const rc = Number(form.requestedCredits);
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          message: form.message.trim(),
          requestedCredits: Number.isInteger(rc) && rc > 0 ? rc : undefined,
        }),
      });
      if (res.status === 409) {
        setHasOpen(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not submit your request. Please try again.');
        return;
      }
      setDone(true);
      setHasOpen(true);
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const locked = hasOpen || done;
  const credits = ledger?.credits ?? user?.credits ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('billing.title', 'Billing & project capacity')}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {ledger?.subscription
              ? `On the ${ledger.subscription.tier} plan.`
              : `${t('billing.creditsCount', 'You have {{count}} project credit(s).', { count: credits })}`}
          </p>
        </div>
        {ledger?.subscription && (
          <button
            onClick={() => void openPortal()}
            disabled={portalBusy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            {portalBusy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Manage subscription
          </button>
        )}
      </div>

      {/* Per-period project allowance */}
      {quota && quota.allowance !== null && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-300">
              Projects this month
              <span className="text-gray-500 ml-1.5">
                {quota.tier ? `· ${quota.tier} plan` : ''}
              </span>
            </span>
            <span className="font-mono font-bold text-white">
              {quota.usedThisPeriod} / {quota.allowance}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                quota.allowed
                  ? quota.remaining !== null && quota.remaining <= 1
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                  : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min(100, Math.round((quota.usedThisPeriod / Math.max(1, quota.allowance)) * 100))}%`,
              }}
            />
          </div>
          {quota.periodEnd && (
            <p className="mt-2 text-[11px] text-gray-500">
              Resets {new Date(quota.periodEnd).toLocaleDateString()}. Projects you have already
              started stay accessible after the reset.
            </p>
          )}
          {!quota.allowed && quota.reason === 'quota_exhausted' && (
            <p className="mt-2 text-xs text-amber-400">
              You have used this period&apos;s allowance. Upgrade below, or buy a single project
              pass if you need to start one more project now.
            </p>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* --- Subscriptions --- */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CreditCard size={15} className="text-orange-400" />
            Subscription
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-gray-700 p-0.5 text-xs">
            <button
              onClick={() => setAnnual(false)}
              className={`px-2.5 py-1 rounded ${!annual ? 'bg-orange-600 text-white' : 'text-gray-400'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-2.5 py-1 rounded ${annual ? 'bg-orange-600 text-white' : 'text-gray-400'}`}
            >
              Annual <span className="text-emerald-400">-20%</span>
            </button>
          </div>
        </div>

        {checkoutEnabled === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Checking availability…
          </div>
        ) : !checkoutEnabled ? (
          <p className="text-sm text-gray-400">
            Card checkout is not enabled on this deployment. Use the request form below and an
            admin will grant credits, or ask about a promo code.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CATALOGUE.map((tier) => {
              const price = annual ? tier.annualMonthly : tier.monthly;
              const current = ledger?.subscription?.tier === tier.key;
              return (
                <div
                  key={tier.key}
                  className={`rounded-lg border p-4 flex flex-col ${
                    current
                      ? 'border-orange-500/60 bg-orange-500/5'
                      : tier.key === 'professional'
                        ? 'border-orange-500/30'
                        : 'border-gray-800'
                  }`}
                >
                  <div className="text-sm font-bold text-white">{tier.label}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white font-mono">${price}</span>
                    <span className="text-xs text-gray-500">/mo</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-gray-400 flex-1">
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      {tier.projects} project{tier.projects === 1 ? '' : 's'} / month
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      {tier.seats} seat{tier.seats === 1 ? '' : 's'} included
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      +$39 /seat /mo
                    </li>
                  </ul>
                  <button
                    onClick={() =>
                      void startCheckout(
                        `${tier.key}_${annual ? 'annual' : 'monthly'}`
                      )
                    }
                    disabled={busy !== null || current}
                    className="mt-4 w-full px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {busy === `${tier.key}_${annual ? 'annual' : 'monthly'}` ? (
                      <Loader2 size={14} className="animate-spin mx-auto" />
                    ) : current ? (
                      'Current plan'
                    ) : (
                      `Choose ${tier.label}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Single project pass — deliberately the most expensive way to buy one. */}
        <div className="rounded-lg border border-gray-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Single Project Pass</div>
            <div className="text-xs text-gray-400 mt-0.5">
              One project, one user, every paid feature. No subscription.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-amber-300 font-mono">$49</span>
            <button
              onClick={() => void startCheckout('single_project_pass')}
              disabled={busy !== null || checkoutEnabled === false}
              className="px-3 py-2 rounded-lg border border-gray-700 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === 'single_project_pass' ? (
                <Loader2 size={14} className="animate-spin mx-auto" />
              ) : (
                'Buy one project'
              )}
            </button>
          </div>
        </div>
      </section>

      {/* --- Promo code --- */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Ticket size={15} className="text-amber-400" />
          Have a promo code?
        </h2>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && void redeem()}
            placeholder="ENTER-CODE"
            className={INPUT + ' sm:max-w-xs font-mono'}
            maxLength={40}
          />
          <button
            onClick={() => void redeem()}
            disabled={busy !== null || !promoCode.trim()}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'promo' ? 'Checking…' : 'Redeem'}
          </button>
        </div>
        {promoMsg && (
          <div
            className={`mt-2 text-sm ${
              promoMsg.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {promoMsg.text}
          </div>
        )}
      </section>

      {/* --- Credit history --- */}
      {ledger && ledger.transactions.length > 0 && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-sm font-bold text-white">Credit history</h2>
          <ul className="mt-3 space-y-1.5">
            {ledger.transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {REASON_LABEL[tx.reason] ?? tx.reason}
                  {tx.note ? ` — ${tx.note}` : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`font-mono font-bold ${
                      tx.delta > 0 ? 'text-emerald-400' : 'text-orange-400'
                    }`}
                  >
                    {tx.delta > 0 ? '+' : ''}
                    {tx.delta}
                  </span>
                  <span className="text-gray-600 font-mono">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Fallback: captured-lead request form --- */}
      {checkoutEnabled === false && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <div>
            <h2 className="text-sm font-bold text-white">Request credits from support</h2>
            <p className="text-xs text-gray-400 mt-1">
              Card checkout is unavailable, so an admin will grant credits manually.
            </p>
          </div>

          {locked && (
            <div className="flex items-start gap-3 rounded-xl border border-orange-800/60 bg-orange-900/15 px-4 py-3 text-sm">
              <span className="text-orange-200">
                {done
                  ? t('billing.requestSent', "Your request was sent. An admin will reach out — you'll be able to request again once this one is closed.")
                  : t('billing.alreadyOpen', 'You already have an open credit request. An admin will reach out to grant you credits.')}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-medium text-gray-400">{t('billing.emailReply', 'Email (we reply here)')}</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={locked}
              placeholder="you@example.com"
              className={INPUT + (locked ? ' opacity-60 cursor-not-allowed' : '')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="requestedCredits" className="text-xs font-medium text-gray-400">
              {t('billing.requestedCredits', 'Requested credits')}{' '}
              <span className="text-gray-600 font-normal">{t('billing.optional', '(optional)')}</span>
            </label>
            <input
              id="requestedCredits"
              type="number"
              min={1}
              value={form.requestedCredits}
              onChange={(e) => setForm({ ...form, requestedCredits: e.target.value })}
              disabled={locked}
              placeholder="e.g. 5"
              className={INPUT + (locked ? ' opacity-60 cursor-not-allowed' : '')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-xs font-medium text-gray-400">{t('billing.message', 'Message')}</label>
            <textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              disabled={locked}
              rows={4}
              placeholder={t('billing.messagePlaceholder', 'What are you working on and how many projects do you need to create?')}
              className={INPUT + (locked ? ' opacity-60 cursor-not-allowed' : '')}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || locked}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? t('billing.sending', 'Sending…') : t('billing.requestCredits', 'Request credits')}
            </button>
            <Link href="/projects" className="text-sm text-gray-400 hover:text-orange-300 transition-colors">
              {t('billing.backToProjects', 'Back to projects')}
            </Link>
          </div>
        </form>
      )}

      {checkoutEnabled !== false && (
        <Link href="/projects" className="inline-block text-sm text-gray-400 hover:text-orange-300 transition-colors">
          {t('billing.backToProjects', 'Back to projects')}
        </Link>
      )}
    </div>
  );
}
