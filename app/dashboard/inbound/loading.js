'use client';

import LoadingDots from '@/components/LoadingDots';

export default function Loading() {
  return <LoadingDots title="Loading inbound receipts" description="Fetching stock received at warehouse…" color="bg-success" />;
}
