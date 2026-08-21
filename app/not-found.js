'use client';

import Link from 'next/link';
import { ArrowLeft, Home, PackageSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-6 max-w-md animate-scale-up">
        {/* Animated Icon Container */}
        <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary relative overflow-hidden">
          <PackageSearch size={48} className="animate-pulse" />
          <div className="absolute -inset-10 bg-gradient-to-tr from-transparent via-primary/5 to-transparent rotate-45 pointer-events-none" />
        </div>

        {/* Text Details */}
        <div className="flex flex-col gap-2 font-sans">
          <h1 className="text-5xl font-display font-extrabold text-text-primary tracking-tight leading-none">404</h1>
          <h2 className="text-lg font-bold text-text-primary mt-1">Page Not Found</h2>
          <p className="text-xs text-text-secondary leading-relaxed px-4">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2 font-sans">
          <button
            onClick={() => router.back()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go Back</span>
          </button>
          
          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-colors cursor-pointer"
          >
            <Home size={14} />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
