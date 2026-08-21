'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Application Error Caught:", error);
  }, [error]);

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-6 max-w-md animate-scale-up">
        {/* Error Icon */}
        <div className="w-20 h-20 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <AlertTriangle size={40} className="animate-bounce" />
        </div>

        {/* Text Details */}
        <div className="flex flex-col gap-2 font-sans">
          <h2 className="text-lg font-bold text-text-primary">Something went wrong!</h2>
          <p className="text-xs text-text-secondary leading-relaxed px-4">
            An unexpected error occurred while loading this page. Let's try reloading or head back to safety.
          </p>
          {error?.message && (
            <div className="mt-2 text-[10px] font-mono bg-surface-elevated text-danger/80 border border-border p-2 rounded-lg max-w-xs mx-auto truncate">
              {error.message}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2 font-sans">
          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
          
          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Home size={14} />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
