'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';

const INPUT = 'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 w-full';

/**
 * /billing — the captured-lead "buy" destination (Approach B).
 *
 * Admins redirect to /admin/users (they grant credits, not request them). A
 * non-admin with an OPEN lead sees a notice and the form is locked (one OPEN
 * per user — the CQ-C invariant enforced server-side; the button self-disables
 * so the submit can't even fire). The email field is pre-filled from user.email
 * (collected at signup — Track 2) and stays editable so a legacy null-email
 * user can still submit a replyable address.
 */
export default function BillingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslation();

  const [hasOpen, setHasOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ email: '', message: '', requestedCredits: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

  // Admin special-case: grants happen in /admin/users, not here. Kept in an
  // effect (not during render) so it's not a render-phase side effect.
  useEffect(() => {
    if (user?.role === 'ADMIN') router.push('/admin/users');
  }, [user, router]);

  if (checking) {
    return <div className="p-6 text-gray-500">{t('common.loading', 'Loading…')}</div>;
  }

  if (user?.role === 'ADMIN') {
    return <div className="p-6 text-gray-500">Redirecting…</div>;
  }

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('billing.title', 'Get project credits')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('billing.creditsCount', 'You have {{count}} project credit(s). Request more and our team will reach out.', { count: user?.credits ?? 0 })}
        </p>
      </div>

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
      </form>
    </div>
  );
}
