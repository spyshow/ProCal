'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';

export default function SignupPage() {
  const router = useRouter();
  const { t, isRtl } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      setError(t('auth.invalidCredentials', 'Please fill in all fields.'));
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Registration failed. Please try again.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          'radial-gradient(ellipse at center, #111827 0%, #030712 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm px-8 py-10"
          style={{ backgroundColor: 'rgba(17,24,39,0.80)' }}
        >
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-8 select-none">
            <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-orange-600/15 ring-1 ring-orange-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className="w-9 h-9"
                aria-hidden="true"
              >
                <path
                  d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
                  fill="#ea580c"
                  stroke="#fb923c"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-none">
              {t('common.appName', 'ProCal')}
            </h1>
            <p className="mt-2 text-sm font-medium tracking-widest text-gray-400 uppercase text-center">
              {t('auth.signupTitle', 'Create Your Account')}
            </p>
            <div className="mt-6 w-full border-t border-gray-700/60" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('auth.name', 'Full Name')}
              </label>
              <div className="relative">
                <input
                  id="name"
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.name', 'Enter your full name')}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('auth.email', 'Email Address')}
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('auth.username', 'Username')}
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.username', 'Choose a username')}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('auth.password', 'Password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password', 'Create a password')}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={isRtl ? "absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 hover:text-orange-400 transition-colors" : "absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-orange-400 transition-colors"}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="text-xs text-slate-400">{showPassword ? '●●●' : '👁'}</span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('auth.password', 'Confirm Password')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.password', 'Confirm your password')}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>{t('common.loading', 'Creating account...')}</span>
              ) : (
                <span>{t('auth.signUpBtn', 'Create Account')}</span>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <Link href="/login" className="font-medium text-orange-500 hover:text-orange-400 transition-colors">
              {t('auth.signInBtn', 'Sign in')}
            </Link>
          </div>
        </div>

        {/* ── Language Selector in Bottom Section ── */}
        <div className="mt-6 flex justify-center">
          <LanguageSelector variant="footer" />
        </div>

        <p className="mt-4 text-center text-xs text-gray-600 select-none">
          &copy; 2026&nbsp;
          <span className="text-gray-500 font-medium">ProCal</span>
          &nbsp;&mdash;&nbsp;{t('common.appTagline', 'Professional Electrical Engineering Software.')}
        </p>
      </div>
    </div>
  );
}

