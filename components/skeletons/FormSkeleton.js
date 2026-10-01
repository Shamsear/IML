'use client';

import React from 'react';
import { SkeletonBox, SkeletonText } from './SkeletonBase';

export default function FormSkeleton({
  title = 'Loading Form...',
  subtitle = 'Please wait while form details load...',
  fieldsCount = 5,
}) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Back button placeholder */}
      <SkeletonBox className="h-8 w-28 rounded-lg" />

      {/* Form Container */}
      <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-2 pb-4 border-b border-border">
          <SkeletonText width="w-48" height="h-6" />
          <SkeletonText width="w-72" height="h-3.5" />
        </div>

        <div className="flex flex-col gap-5">
          {Array.from({ length: fieldsCount }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <SkeletonText width="w-24" height="h-3" />
              <SkeletonBox className="h-10 w-full rounded-lg" />
            </div>
          ))}

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <SkeletonBox className="h-10 w-24 rounded-lg" />
            <SkeletonBox className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
