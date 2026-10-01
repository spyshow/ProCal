'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeSelector } from '@/components/ThemeSelector';

export default function LoginPage() {
  const { t, isRtl } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotIdentifier.trim()) {
      setForgotError(t('auth.username', 'Please enter your username or email address.'));
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setForgotError(data?.error || t('auth.invalidCredentials', 'An error occurred. Please try again.'));
        return;
      }

      setForgotSuccess(true);
      if (data?.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch {
      setForgotError(t('auth.invalidCredentials', 'Unable to connect to the server. Please try again.'));
    } finally {
      setIsForgotLoading(false);
    }
  };

  const resetForgotState = () => {
    setShowForgotModal(false);
    setForgotIdentifier('');
    setForgotSuccess(false);
    setForgotError('');
    setDevResetUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError(t('auth.invalidCredentials', 'Please enter both username and password.'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || data?.message || t('auth.invalidCredentials', 'Invalid credentials. Please try again.'));
        return;
      }

      // Hard redirect to dashboard ensures session cookie is attached to all subsequent server requests
      window.location.href = '/dashboard';
    } catch {
      setError(t('auth.invalidCredentials', 'Unable to connect to the server. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] bg-grid-pattern transition-colors duration-200"
    >
      {/* ── Card ── */}
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]/90 shadow-2xl backdrop-blur-md px-8 py-10 transition-colors duration-200"
        >
          {/* ── Brand Header ── */}
          <div className="flex flex-col items-center mb-8 select-none">
            {/* Lightning bolt SVG */}
            <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-orange-600/15 ring-1 ring-orange-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className="w-9 h-9"
                aria-hidden="true"
              >
                {/* Electrical zap / lightning bolt */}
                <path
                  d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
                  fill="#ea580c"
                  stroke="#fb923c"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* App name */}
            <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground-color,#fff)] leading-none">
              {t('common.appName', 'ProCal')}
            </h1>

            {/* Slogan */}
            <p className="mt-2 text-sm font-medium tracking-normal text-[var(--table-header-color,#9ca3af)] text-center">
              Low-voltage Electrical design, <span className="text-orange-500 dark:text-orange-400 font-bold">Solved</span>
            </p>

            {/* Divider */}
            <div className="mt-6 w-full border-t border-[var(--border-color,#374151)]/60" />
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-color,#9ca3af)]"
              >
                {t('auth.username', 'Username')}
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.username', 'Enter username')}
                  className="
                    w-full rounded-lg border border-[var(--input-border,#374151)] bg-[var(--input-bg,rgba(17,24,39,0.8))]
                    px-4 py-3 text-sm text-[var(--input-color,#ffffff)] placeholder-[var(--table-header-color,#6b7280)]
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-all shadow-sm
                  "
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--table-header-color,#9ca3af)]"
                >
                  {t('auth.password', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotIdentifier(username || '');
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 font-medium transition-colors"
                >
                  {t('auth.forgotPassword', 'Forgot Password?')}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password', 'Enter password')}
                  className="
                    w-full rounded-lg border border-[var(--input-border,#374151)] bg-[var(--input-bg,rgba(17,24,39,0.8))]
                    px-4 py-3 text-sm text-[var(--input-color,#ffffff)] placeholder-[var(--table-header-color,#6b7280)]
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-all shadow-sm
                  "
                />
                {/* Show / Hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={isRtl ? "absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--table-header-color,#9ca3af)] hover:text-orange-500 transition-colors" : "absolute inset-y-0 right-0 flex items-center pr-3.5 text-[var(--table-header-color,#9ca3af)] hover:text-orange-500 transition-colors"}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="text-xs text-[var(--table-header-color,#9ca3af)]">{showPassword ? '●●●' : '👁'}</span>
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300"
              >
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                relative w-full rounded-lg bg-orange-600 hover:bg-orange-500
                disabled:bg-orange-800 disabled:cursor-not-allowed
                text-white font-semibold py-3 px-6 text-sm
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                flex items-center justify-center gap-2 shadow-md
              "
            >
              {isLoading ? (
                <span>{t('common.loading', 'Authenticating...')}</span>
              ) : (
                <span>{t('auth.signInBtn', 'Sign In')}</span>
              )}
            </button>
          </form>

          {/* ── Sign Up Link ── */}
          <div className="mt-6 text-center text-sm text-[var(--table-header-color,#9ca3af)]">
            {t('auth.noAccount', "Don't have an account?")}{' '}
            <Link href="/signup" className="font-medium text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors">
              {t('auth.signUpBtn', 'Create one')}
            </Link>
          </div>
        </div>

        {/* ── Theme & Language Selector in Bottom Section ── */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <ThemeSelector variant="footer" />
          <LanguageSelector variant="footer" />
        </div>

        <p className="mt-4 text-center text-xs text-[var(--table-header-color,#6b7280)] select-none">
          &copy; 2026&nbsp;
          <span className="text-[var(--foreground-color,#9ca3af)] font-medium">ProCal</span>
          &nbsp;&mdash;&nbsp;Low-voltage Electrical design, <span className="text-orange-500 dark:text-orange-400 font-medium">Solved</span>
        </p>
      </div>

      {/* ── Reset Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border-color,#374151)] bg-[var(--card-bg,#111827)] p-6 shadow-2xl text-left transition-colors"
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color,#1f2937)]">
              <h3 className="text-lg font-bold text-[var(--foreground-color,#fff)] flex items-center gap-2">
                <span className="text-orange-500">⚡</span>
                {t('auth.forgotPasswordTitle', 'Reset Your Password')}
              </h3>
              <button
                type="button"
                onClick={resetForgotState}
                className="text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#fff)] transition-colors p-1 rounded-lg hover:bg-[var(--card-bg-subtle,#1f2937)] text-sm"
              >
                ✕
              </button>
            </div>

            {forgotSuccess ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-xl bg-green-950/20 border border-green-800/40 text-emerald-600 dark:text-green-200 text-center">
                  <div className="text-2xl mb-1">✓</div>
                  <h4 className="text-sm font-semibold text-emerald-600 dark:text-green-300">
                    {t('auth.resetLinkSent', 'Reset Link Sent')}
                  </h4>
                  <p className="text-xs text-[var(--table-header-color,#9ca3af)] mt-1 leading-relaxed">
                    {t(
                      'auth.resetLinkSentDesc',
                      'If an account matches that username or email, a password reset link has been sent. Please check your inbox and spam folder.'
                    )}
                  </p>
                </div>

                {devResetUrl && (
                  <div className="p-3 rounded-lg bg-orange-950/20 border border-orange-700/40 text-xs">
                    <div className="font-semibold text-orange-500 dark:text-orange-300 mb-1">
                      Development Direct Link:
                    </div>
                    <a
                      href={devResetUrl}
                      className="text-orange-500 dark:text-orange-400 hover:underline break-all text-[11px]"
                    >
                      {devResetUrl}
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={resetForgotState}
                  className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors shadow-md"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="py-4 space-y-4">
                <p className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                  {t(
                    'auth.forgotPasswordDesc',
                    "Enter your username or email address and we'll send you a link to reset your password."
                  )}
                </p>

                <div>
                  <label
                    htmlFor="forgot-identifier"
                    className="block mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--table-header-color,#9ca3af)]"
                  >
                    {t('auth.username', 'Username or Email')}
                  </label>
                  <input
                    id="forgot-identifier"
                    type="text"
                    autoFocus
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="john@example.com or engineer_john"
                    className="w-full rounded-lg border border-[var(--input-border,#374151)] bg-[var(--input-bg,#1f2937)] px-3.5 py-2.5 text-sm text-[var(--input-color,#fff)] placeholder-[var(--table-header-color,#6b7280)] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>

                {forgotError && (
                  <div className="p-3 rounded-lg bg-red-950/20 border border-red-800/40 text-xs text-red-500 dark:text-red-300">
                    {forgotError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetForgotState}
                    className="px-4 py-2 rounded-lg bg-[var(--card-bg-subtle,#1f2937)] hover:bg-[var(--border-color,#374151)] text-[var(--foreground-color,#e5e7eb)] text-xs font-medium transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md"
                  >
                    {isForgotLoading ? t('common.loading', 'Sending...') : t('auth.sendResetLink', 'Send Reset Link')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
