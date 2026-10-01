'use client';

import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonBadge, SkeletonHeader } from './SkeletonBase';

export default function TableSkeleton({
  title = 'Loading Ledger...',
  subtitle = 'Fetching latest data records and summary...',
  columns = 7,
  rows = 8,
  hasFilters = true,
  hasTabs = false,
  tabsCount = 2,
  actionCount = 2,
  statCardsCount = 0,
}) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <SkeletonHeader
        titleWidth="w-56"
        subtitleWidth="w-80"
        hasActions={true}
        actionCount={actionCount}
      />

      {/* Optional Stats Cards */}
      {statCardsCount > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${statCardsCount} gap-4`}>
          {Array.from({ length: statCardsCount }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border p-4 sm:p-5 rounded-xl shadow-sm flex items-center gap-3 sm:gap-4"
            >
              <SkeletonBox className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <SkeletonText width="w-20" height="h-3" />
                <SkeletonText width="w-16" height="h-6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optional Tabs */}
      {hasTabs && (
        <div className="flex items-center gap-4 border-b border-border pb-3">
          {Array.from({ length: tabsCount }).map((_, i) => (
            <SkeletonBox key={i} className="h-8 w-28 rounded-lg" />
          ))}
        </div>
      )}

      {/* Table Container */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Filter Bar */}
        {hasFilters && (
          <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-elevated/20">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <SkeletonBox className="h-9 w-full rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-9 w-28 rounded-lg" />
              <SkeletonBox className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        )}

        {/* Top Pagination Placeholder */}
        <div className="px-4 py-3 border-b border-border/60 bg-surface-elevated/10 flex items-center justify-between">
          <SkeletonText width="w-36" height="h-3.5" />
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-7 w-16 rounded-md" />
            <SkeletonBox className="h-7 w-16 rounded-md" />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="bg-surface-elevated/40">
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="py-3 px-4 sm:px-5">
                    <SkeletonText
                      width={i === 0 ? 'w-24' : i === 1 ? 'w-32' : 'w-20'}
                      height="h-3"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-surface-elevated/10">
                  {Array.from({ length: columns }).map((_, colIdx) => (
                    <td key={colIdx} className="py-3.5 px-4 sm:px-5">
                      {colIdx === 0 ? (
                        <SkeletonText width="w-28" height="h-4" />
                      ) : colIdx === 1 ? (
                        <div className="flex flex-col gap-1">
                          <SkeletonText width="w-36" height="h-4" />
                          <SkeletonText width="w-20" height="h-2.5" />
                        </div>
                      ) : colIdx === columns - 1 ? (
                        <div className="flex justify-end gap-1.5">
                          <SkeletonBox className="h-7 w-7 rounded-md" />
                          <SkeletonBox className="h-7 w-7 rounded-md" />
                        </div>
                      ) : colIdx % 3 === 0 ? (
                        <SkeletonBadge width="w-16" />
                      ) : colIdx % 2 === 0 ? (
                        <SkeletonText width="w-16" height="h-4" className="mx-auto" />
                      ) : (
                        <SkeletonText width="w-20" height="h-3.5" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Placeholder */}
        <div className="px-4 py-3 border-t border-border/60 bg-surface-elevated/10 flex items-center justify-between">
          <SkeletonText width="w-36" height="h-3.5" />
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-7 w-16 rounded-md" />
            <SkeletonBox className="h-7 w-16 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
