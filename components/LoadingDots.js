'use client';

import React from 'react';
import { Package } from 'lucide-react';

/**
 * Premium branded loading component with soft ambient glow, smooth spin physics,
 * and optional supporting context text.
 */
export default function LoadingDots({
  title = 'Loading...',
  description = 'Fetching data, please wait a moment',
  size = 'md', // 'sm', 'md', 'lg'
  fullPage = false,
  className = '',
}) {
  return (
    <div
      className={`w-full flex items-center justify-center p-6 ${
        fullPage ? 'min-h-screen' : 'min-h-[50vh]'
      } ${className}`}
    >
      <div className="relative flex flex-col items-center gap-4 text-center max-w-sm px-4">
        {/* Soft Ambient Glow */}
        <div className="absolute w-24 h-24 bg-primary/10 rounded-full blur-2xl -top-4 pointer-events-none" />

        {/* Branded Spinning Icon & Progress Ring */}
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-center text-primary relative z-10">
            <Package size={24} className="animate-pulse" />
          </div>
          {/* Outer rotating ring */}
          <div className="absolute -inset-1.5 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
        </div>

        {/* Heading and details */}
        {(title || description) && (
          <div className="flex flex-col gap-1.5 mt-2 z-10">
            {title && (
              <h3 className="font-display font-bold text-base text-text-primary tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-text-secondary leading-relaxed max-w-xs">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Pulse Indicator Pills */}
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.2s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary/70 animate-[pulse_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-[pulse_1.2s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}
