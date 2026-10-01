'use client';

import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonCircle } from './SkeletonBase';

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Banner / Welcome Row */}
      <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <SkeletonText width="w-64" height="h-7" />
          <SkeletonText width="w-80" height="h-4" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <SkeletonBox className="h-9 w-32 rounded-lg" />
          <SkeletonBox className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* KPI Stats Grid (4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border p-4 sm:p-5 rounded-xl shadow-sm flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <SkeletonText width="w-24" height="h-3" />
              <SkeletonBox className="w-8 h-8 rounded-lg" />
            </div>
            <div className="flex items-baseline justify-between">
              <SkeletonText width="w-20" height="h-7" />
              <SkeletonBox className="w-12 h-4 rounded-full" />
            </div>
            <SkeletonText width="w-32" height="h-2.5" />
          </div>
        ))}
      </div>

      {/* 2-Column Analytics & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart / Distribution panel (2 cols) */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex flex-col gap-1">
              <SkeletonText width="w-40" height="h-4" />
              <SkeletonText width="w-60" height="h-3" />
            </div>
            <SkeletonBox className="h-7 w-24 rounded-md" />
          </div>
          <div className="h-56 w-full flex items-end justify-between gap-3 pt-4 px-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <SkeletonBox
                  className={`w-full rounded-t-md ${
                    i % 2 === 0 ? 'h-36' : i % 3 === 0 ? 'h-48' : 'h-28'
                  }`}
                />
                <SkeletonText width="w-8" height="h-2.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Low Stock Alerts (1 col) */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <SkeletonText width="w-32" height="h-4" />
            <SkeletonBox className="h-6 w-14 rounded-full" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-3 bg-surface-elevated/40 border border-black/5 rounded-lg flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <SkeletonCircle size="w-8 h-8" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <SkeletonText width="w-24" height="h-3" />
                    <SkeletonText width="w-16" height="h-2" />
                  </div>
                </div>
                <SkeletonBox className="h-6 w-14 rounded-md flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity / Transactions Section */}
      <div className="bg-surface border border-border rounded-xl shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <SkeletonText width="w-44" height="h-4" />
          <SkeletonBox className="h-7 w-20 rounded-md" />
        </div>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-3 bg-surface-elevated/30 border border-border/50 rounded-lg flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <SkeletonBox className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex flex-col gap-1 min-w-0">
                  <SkeletonText width="w-36" height="h-3.5" />
                  <SkeletonText width="w-28" height="h-2.5" />
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <SkeletonBox className="h-5 w-16 rounded-full" />
                <SkeletonText width="w-12" height="h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
