'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, FolderGit2 } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Unhandled App Runtime Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-full max-w-lg p-6 rounded-2xl border border-red-500/30 bg-gray-900/90 shadow-2xl backdrop-blur-md">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-100 mb-2">
          Calculation or View Error
        </h2>

        <p className="text-sm text-gray-400 mb-6">
          An unexpected error occurred while rendering this page or computing electrical values.
          Your project data has not been lost.
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
            href="/projects"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-semibold transition-colors"
          >
            <FolderGit2 className="w-4 h-4" />
            Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
