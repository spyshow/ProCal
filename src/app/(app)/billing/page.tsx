'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';

const INPUT = 'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 w-full';

interface BillingPackOption {
  credits: 1 | 3 | 10;
  title: string;
  price: number;
  perProject: number;
  saving?: string;
  popular?: boolean;
  desc: string;
}

const CREDIT_PACKS: BillingPackOption[] = [
  {
    credits: 1,
    title: 'Single Project',
    price: 49,
    perProject: 49,
    desc: '1 project credit • Valid 24 months • No renewal',
  },
  {
    credits: 3,
    title: '3 Projects Pack',
    price: 99,
    perProject: 33,
    saving: 'Save 33%',
    popular: true,
    desc: '3 project credits • $33/project • Valid 24 months',
  },
  {
    credits: 10,
    title: '10 Projects Pack',
    price: 249,
    perProject: 25,
    saving: 'Save 49%',
    desc: '10 project credits • $25/project • Valid 24 months',
  },
];

function buildPackMessage(pack: BillingPackOption): string {
  return `I would like to purchase the ${pack.title} (${pack.credits} project credit${pack.credits > 1 ? 's' : ''} — $${pack.price} one-off).`;
}

/**
 * /billing — the captured-lead "buy" destination (Approach B).
 *
 * Non-admins with an OPEN lead see a notice and the form is locked (one OPEN
 * per user — the CQ-C invariant enforced server-side; the button self-disables
 * so the submit can't even fire). Admins see an admin banner with quick links
 * to /admin/users and /admin/leads while still being able to inspect the page.
 */
export default function BillingPage() {
  const { user } = useUser();
  const { t } = useTranslation();

  const [hasOpen, setHasOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ email: '', message: '', requestedCredits: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const creditsParam = Number(params.get('credits'));
      const matchedPack = CREDIT_PACKS.find((p) => p.credits === creditsParam);
      if (matchedPack) {
        setForm((f) => ({
          ...f,
          requestedCredits: String(matchedPack.credits),
          message: f.message || buildPackMessage(matchedPack),
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, email: user.email ?? '' }));
    // Whether the user already has an OPEN lead. Uses the same envelope as the
    // other auth-family routes; a down route degrades to "let them try" rather
    // than a hard block, so we don't 404-spiral the whole page.
    fetch('/api/contact', { cache: 'no-store', method: 'GET' })
      .then((r) => (r.ok ? r.json() : { hasOpen: false }))
      .then((data) => setHasOpen(Boolean(data.hasOpen)))
      .finally(() => setChecking(false));
  }, [user]);

  if (checking) {
    return <div className="p-6 text-gray-500">{t('common.loading', 'Loading…')}</div>;
  }

  const isAdmin = user?.role === 'ADMIN';
  const locked = hasOpen || done;

  const selectPack = (pack: BillingPackOption) => {
    if (locked) return;
    setForm((f) => {
      const isDefaultOrEmpty =
        !f.message.trim() || CREDIT_PACKS.some((p) => f.message.trim() === buildPackMessage(p));
      return {
        ...f,
        requestedCredits: String(pack.credits),
        message: isDefaultOrEmpty ? buildPackMessage(pack) : f.message,
      };
    });
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

  const selectedCreditsNum = Number(form.requestedCredits);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('billing.title', 'Get project credits')}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('billing.creditsCount', 'You have {{count}} project credit(s). Request more and our team will reach out.', { count: user?.credits ?? 0 })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900/80 text-xs font-mono text-gray-300">
          <Clock className="w-3.5 h-3.5 text-orange-400" />
          <span>Valid 24 months • One-off • No auto-renewal</span>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-950/20 px-4 py-3 text-sm">
          <div className="text-orange-200">
            <span className="font-semibold text-orange-400">Admin Account:</span> You can grant project credits directly in User Management or review incoming requests in Billing Leads.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
            >
              Manage Users
            </Link>
            <Link
              href="/admin/leads"
              className="px-3 py-1.5 rounded-lg border border-orange-500/40 hover:bg-orange-500/10 text-orange-300 text-xs font-semibold transition-colors"
            >
              Billing Leads
            </Link>
          </div>
        </div>
      )}

      {locked && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-800/60 bg-orange-900/15 px-4 py-3 text-sm">
          <span className="flex-shrink-0 text-orange-400 mt-0.5">●</span>
          <span className="text-orange-200">
            {done
              ? t('billing.requestSent', "Your request was sent. An admin will reach out — you'll be able to request again once this one is closed.")
              : t('billing.alreadyOpen', "You already have an open credit request. An admin will reach out to grant you credits.")}
          </span>
        </div>
      )}

      {/* Credit Pack Selector Cards */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-2.5">
          Select a credit pack (or enter a custom amount below)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {CREDIT_PACKS.map((pack) => {
            const isSelected = selectedCreditsNum === pack.credits;
            return (
              <button
                key={pack.credits}
                type="button"
                disabled={locked}
                onClick={() => selectPack(pack)}
                className={`relative text-start rounded-xl p-4 border transition-all ${
                  isSelected
                    ? 'border-2 border-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(234,88,12,0.15)]'
                    : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {pack.popular && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-2.5 h-2.5" />
                    Most popular
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{pack.title}</span>
                  {pack.saving && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {pack.saving}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black font-mono text-white">${pack.price}</span>
                  <span className="text-xs font-mono text-gray-400">one-off</span>
                </div>
                <p className="mt-1.5 text-[11px] font-mono text-gray-400">{pack.desc}</p>
                {isSelected && (
                  <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected ({pack.credits} {pack.credits === 1 ? 'credit' : 'credits'})</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
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
            {t('billing.requestedCredits', 'Requested credits')} <span className="text-gray-600 font-normal">{t('billing.optional', '(optional)')}</span>
          </label>
          <input
            id="requestedCredits"
            type="number"
            min={1}
            value={form.requestedCredits}
            onChange={(e) => setForm({ ...form, requestedCredits: e.target.value })}
            disabled={locked}
            placeholder="e.g. 3"
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
            rows={5}
            placeholder={t('billing.messagePlaceholder', 'What are you working on and how many projects do you need to create?')}
            className={INPUT + (locked ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || locked}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('billing.sending', 'Sending…') : t('billing.requestCredits', 'Request credits')}
            </button>
            <Link href="/projects" className="text-sm text-gray-400 hover:text-orange-300 transition-colors">
              {t('billing.backToProjects', 'Back to projects')}
            </Link>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Every credit unlocks all IEC &amp; NEC features + PDF/SLD/BOM exports</span>
          </div>
        </div>
      </form>
    </div>
  );
}

