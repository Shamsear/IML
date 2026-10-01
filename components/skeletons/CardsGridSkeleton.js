'use client';

import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonCircle, SkeletonHeader } from './SkeletonBase';

export default function CardsGridSkeleton({
  count = 6,
  cardType = 'brand', // 'brand', 'store', 'supervisor'
  actionCount = 2,
}) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <SkeletonHeader
        titleWidth="w-48"
        subtitleWidth="w-72"
        hasActions={true}
        actionCount={actionCount}
      />

      {/* Filter / Search Bar */}
      <div className="bg-surface border border-border p-3.5 rounded-xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SkeletonBox className="h-9 w-full sm:w-72 rounded-lg" />
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-9 w-24 rounded-lg" />
          <SkeletonBox className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4"
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <SkeletonCircle size="w-12 h-12" />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <SkeletonText width="w-32" height="h-4" />
                  <SkeletonText width="w-20" height="h-3" />
                </div>
              </div>
              <SkeletonBox className="h-6 w-14 rounded-full" />
            </div>

            {/* Description placeholder */}
            <div className="flex flex-col gap-1">
              <SkeletonText width="w-full" height="h-2.5" />
              <SkeletonText width="w-3/4" height="h-2.5" />
            </div>

            {/* Metrics chip row */}
            <div className="pt-3 border-t border-border/60 grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <SkeletonText width="w-12" height="h-2.5" />
                <SkeletonText width="w-10" height="h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <SkeletonText width="w-12" height="h-2.5" />
                <SkeletonText width="w-10" height="h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <SkeletonText width="w-12" height="h-2.5" />
                <SkeletonText width="w-10" height="h-4" />
              </div>
            </div>

            {/* Card Action footer */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <SkeletonText width="w-20" height="h-3" />
              <SkeletonBox className="h-7 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
