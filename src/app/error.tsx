'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Unhandled Root Runtime Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md p-8 rounded-2xl border border-red-500/30 bg-gray-900/90 shadow-2xl text-center backdrop-blur-md">
          <div className="flex justify-center mb-5">
            <div className="p-3.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertOctagon className="w-10 h-10" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            Application Error
          </h1>

          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            An unexpected error interrupted the application. Please try reloading the page.
          </p>

          {error.message && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-xs text-red-300 font-mono text-left overflow-x-auto max-h-32">
              {error.message}
              {error.digest && (
                <div className="mt-1 text-gray-500 text-[10px]">
                  Digest: {error.digest}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-semibold transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
