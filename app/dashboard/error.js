'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
        <AlertTriangle size={28} className="text-danger" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-display font-bold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-secondary max-w-md">
          {error?.message || 'An unexpected error occurred while loading this page.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-all duration-200 shadow-sm"
      >
        <RefreshCw size={16} />
        <span>Try Again</span>
      </button>
    </div>
  );
}
