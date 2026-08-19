'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400 text-sm">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const { t, isRtl } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(
    !token ? t('auth.invalidOrExpiredToken', 'Missing or invalid reset token. Please request a new password reset link.') : ''
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError(t('auth.enterNewPassword', 'Please enter a new password.'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.invalidCredentials', 'Password must be at least 6 characters.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.invalidCredentials', 'Passwords do not match.'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || t('auth.invalidOrExpiredToken', 'Failed to reset password. Link may have expired.'));
        return;
      }

      setIsSuccess(true);
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
              <KeyRound className="w-7 h-7 text-orange-500" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white text-center">
              {t('auth.resetPassword', 'Reset Password')}
            </h1>

            <p className="mt-2 text-xs text-gray-400 text-center leading-relaxed">
              {t('auth.enterNewPassword', 'Enter your new password below to reset your account credentials.')}
            </p>

            <div className="mt-6 w-full border-t border-gray-700/60" />
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-green-950/30 border border-green-800/60 text-green-200 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-green-300">
                  {t('auth.resetPassword', 'Password Reset Successful')}
                </h3>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  {t(
                    'auth.passwordResetSuccess',
                    'Password successfully updated! You can now sign in with your new password.'
                  )}
                </p>
              </div>

              <Link
                href="/login"
                className="
                  w-full rounded-lg bg-orange-600 hover:bg-orange-500
                  text-white font-semibold py-3 px-6 text-sm
                  transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40
                "
              >
                <span>{t('auth.signInBtn', 'Sign In to Account')}</span>
              </Link>
            </div>
          ) : (
            /* Reset Form */
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
                >
                  {t('auth.newPassword', 'New Password')}
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    disabled={!token}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.newPassword', 'At least 6 characters')}
                    className="
                      w-full rounded-lg border border-gray-700 bg-gray-800
                      px-4 py-3 text-sm text-white placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                      transition-shadow disabled:opacity-50
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className={isRtl ? "absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 hover:text-orange-400 transition-colors" : "absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-orange-400 transition-colors"}
                  >
                    <span className="text-xs text-slate-400">{showPassword ? '●●●' : '👁'}</span>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
                >
                  {t('auth.confirmNewPassword', 'Confirm New Password')}
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={!token}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmNewPassword', 'Repeat new password')}
                  className="
                    w-full rounded-lg border border-gray-700 bg-gray-800
                    px-4 py-3 text-sm text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-shadow disabled:opacity-50
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
                disabled={isLoading || !token}
                className="
                  relative w-full rounded-lg bg-orange-600 hover:bg-orange-500
                  disabled:bg-orange-800 disabled:cursor-not-allowed
                  text-white font-semibold py-3 px-6 text-sm
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  flex items-center justify-center gap-2 mt-2
                "
              >
                {isLoading ? (
                  <span>{t('auth.updatingPassword', 'Updating Password...')}</span>
                ) : (
                  <span>{t('auth.resetPassword', 'Reset Password')}</span>
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
