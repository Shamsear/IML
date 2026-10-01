'use client';

import React from 'react';

export function SkeletonBox({ className = '', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`skeleton-shimmer bg-surface-elevated/70 ${rounded} border border-border/40 ${className}`}
    />
  );
}

export function SkeletonText({ className = '', width = 'w-24', height = 'h-3.5' }) {
  return (
    <div
      className={`skeleton-shimmer bg-surface-elevated/80 rounded-md ${height} ${width} ${className}`}
    />
  );
}

export function SkeletonCircle({ size = 'w-10 h-10', className = '' }) {
  return (
    <div
      className={`skeleton-shimmer bg-surface-elevated/80 rounded-full border border-border/40 ${size} flex-shrink-0 ${className}`}
    />
  );
}

export function SkeletonBadge({ width = 'w-16', className = '' }) {
  return (
    <div
      className={`skeleton-shimmer bg-surface-elevated/70 rounded-full h-5 ${width} border border-border/30 ${className}`}
    />
  );
}

export function SkeletonHeader({
  titleWidth = 'w-48',
  subtitleWidth = 'w-72',
  hasActions = true,
  actionCount = 2,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
      <div className="flex flex-col gap-2">
        <SkeletonText width={titleWidth} height="h-7 sm:h-8" className="rounded-lg" />
        <SkeletonText width={subtitleWidth} height="h-4" />
      </div>
      {hasActions && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {Array.from({ length: actionCount }).map((_, i) => (
            <SkeletonBox key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}
