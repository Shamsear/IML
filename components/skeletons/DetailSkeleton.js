'use client';

import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonCircle } from './SkeletonBase';

export default function DetailSkeleton({
  hasTabs = true,
  hasTable = true,
  tabsCount = 3,
  statCardsCount = 4,
}) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Back Nav & Quick Action bar */}
      <div className="flex items-center justify-between gap-4">
        <SkeletonBox className="h-8 w-32 rounded-lg" />
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-8 w-24 rounded-lg" />
          <SkeletonBox className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Hero Detail Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6">
        <SkeletonCircle size="w-16 h-16 sm:w-20 sm:h-20" />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <SkeletonText width="w-48 sm:w-64" height="h-7" />
            <SkeletonBox className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonText width="w-80" height="h-3.5" />
          <div className="flex items-center gap-2 mt-1">
            <SkeletonBox className="h-5 w-28 rounded-md" />
            <SkeletonBox className="h-5 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Stats Breakdown Row */}
      {statCardsCount > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: statCardsCount }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border p-3 sm:p-5 rounded-xl shadow-sm flex items-center gap-3 sm:gap-4"
            >
              <SkeletonBox className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <SkeletonText width="w-16" height="h-3" />
                <SkeletonText width="w-14" height="h-6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {hasTabs && (
        <div className="flex items-center gap-6 border-b border-border pb-2">
          {Array.from({ length: tabsCount }).map((_, i) => (
            <SkeletonBox key={i} className="h-8 w-28 rounded-lg" />
          ))}
        </div>
      )}

      {/* Table / Content Panel */}
      {hasTable && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <SkeletonText width="w-40" height="h-5" />
            <SkeletonBox className="h-8 w-28 rounded-lg" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-surface-elevated/40">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <th key={i} className="py-3 px-4">
                      <SkeletonText width="w-20" height="h-3" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {Array.from({ length: 6 }).map((_, colIdx) => (
                      <td key={colIdx} className="py-3.5 px-4">
                        <SkeletonText
                          width={colIdx === 0 ? 'w-32' : 'w-20'}
                          height="h-3.5"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
