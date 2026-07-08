'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || 'Invalid credentials. Please try again.');
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
      {/* ── Card ── */}
      <div className="w-full max-w-md">
        <div
          className="rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm px-8 py-10"
          style={{ backgroundColor: 'rgba(17,24,39,0.80)' }}
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
                {/* spark lines */}
                <line
                  x1="2"
                  y1="7"
                  x2="4.5"
                  y2="7"
                  stroke="#fb923c"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                <line
                  x1="19.5"
                  y1="17"
                  x2="22"
                  y2="17"
                  stroke="#fb923c"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                <line
                  x1="1.5"
                  y1="12"
                  x2="3.5"
                  y2="12"
                  stroke="#fdba74"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  opacity="0.5"
                />
              </svg>
            </div>

            {/* App name */}
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-none">
              Pro<span className="text-orange-500">Cal</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-2 text-sm font-medium tracking-widest text-gray-400 uppercase">
              Electrical Load &amp; MDB Designer
            </p>

            {/* Divider */}
            <div className="mt-6 w-full border-t border-gray-700/60" />
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Username
              </label>
              <div className="relative">
                {/* user icon */}
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="
                    w-full rounded-lg border border-gray-700 bg-gray-800
                    pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-shadow
                  "
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Password
              </label>
              <div className="relative">
                {/* lock icon */}
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="
                    w-full rounded-lg border border-gray-700 bg-gray-800
                    pl-10 pr-11 py-3 text-sm text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-shadow
                  "
                />
                {/* Show / Hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-orange-400 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    /* Eye-off */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-400"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
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
                focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900
                flex items-center justify-center gap-2
              "
            >
              {isLoading ? (
                <>
                  {/* Spinner */}
                  <svg
                    className="animate-spin w-4 h-4 text-orange-200"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span>Authenticating&#8230;</span>
                </>
              ) : (
                <>
                  {/* Zap icon inside button */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z" />
                  </svg>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* ── Sign Up Link ── */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-orange-500 hover:text-orange-400 transition-colors">
              Create one
            </Link>
          </div>
        </div>

        {/* ── Copyright ── */}
        <p className="mt-6 text-center text-xs text-gray-600 select-none">
          &copy; 2025&nbsp;
          <span className="text-gray-500 font-medium">ProCal</span>
          &nbsp;&mdash;&nbsp;Professional Electrical Engineering Software.
        </p>
      </div>
    </div>
  );
}
