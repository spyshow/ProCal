'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ArrowLeft, CheckCircle2, Mail, AlertCircle, Sparkles } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t, isRtl } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError(t('auth.username', 'Please enter your username or email address.'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || t('auth.invalidCredentials', 'An error occurred. Please try again.'));
        return;
      }

      setIsSuccess(true);
      if (data?.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch {
      setError(t('auth.invalidCredentials', 'Unable to connect to the server. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: 'radial-gradient(ellipse at center, #111827 0%, #030712 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm px-8 py-10"
          style={{ backgroundColor: 'rgba(17,24,39,0.80)' }}
        >
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-6 select-none">
            <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-orange-600/15 ring-1 ring-orange-500/30">
              <Mail className="w-7 h-7 text-orange-500" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white text-center">
              {t('auth.forgotPasswordTitle', 'Reset Your Password')}
            </h1>

            <p className="mt-2 text-xs text-gray-400 text-center leading-relaxed">
              {t('auth.forgotPasswordDesc', "Enter your username or email address and we'll send you a link to reset your password.")}
            </p>

            <div className="mt-6 w-full border-t border-gray-700/60" />
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-green-950/30 border border-green-800/60 text-green-200 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-green-300">
                  {t('auth.resetLinkSent', 'Reset Link Sent')}
                </h3>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  {t(
                    'auth.resetLinkSentDesc',
                    'If an account matches that username or email, a password reset link has been sent. Please check your inbox and spam folder.'
                  )}
                </p>
              </div>

              {devResetUrl && (
                <div className="p-3 rounded-lg bg-orange-950/40 border border-orange-700/50 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-orange-300 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Development Direct Link:</span>
                  </div>
                  <a
                    href={devResetUrl}
                    className="text-orange-400 hover:underline break-all text-[11px]"
                  >
                    {devResetUrl}
                  </a>
                </div>
              )}

              <Link
                href="/login"
                className="
                  w-full rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700
                  text-white font-medium py-3 px-6 text-sm
                  transition-colors flex items-center justify-center gap-2
                "
              >
                <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                <span>{t('auth.backToSignIn', 'Back to Sign In')}</span>
              </Link>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label
                  htmlFor="identifier"
                  className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
                >
                  {t('auth.username', 'Username or Email')}
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username email"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="john@example.com or engineer_john"
                  className="
                    w-full rounded-lg border border-gray-700 bg-gray-800
                    px-4 py-3 text-sm text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-shadow
                  "
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-xs text-red-300"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="
                  relative w-full rounded-lg bg-orange-600 hover:bg-orange-500
                  disabled:bg-orange-800 disabled:cursor-not-allowed
                  text-white font-semibold py-3 px-6 text-sm
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  flex items-center justify-center gap-2
                "
              >
                {isLoading ? (
                  <span>{t('common.loading', 'Sending Link...')}</span>
                ) : (
                  <span>{t('auth.sendResetLink', 'Send Reset Link')}</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 transition-colors"
                >
                  <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  <span>{t('auth.backToSignIn', 'Back to Sign In')}</span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Language Selector */}
        <div className="mt-6 flex justify-center">
          <LanguageSelector variant="footer" />
        </div>

        {/* Copyright */}
        <p className="mt-4 text-center text-xs text-gray-600 select-none">
          &copy; 2026&nbsp;
          <span className="text-gray-500 font-medium">ProCal</span>
          &nbsp;&mdash;&nbsp;{t('common.appTagline', 'Professional Electrical Engineering Software.')}
        </p>
      </div>
    </div>
  );
}
