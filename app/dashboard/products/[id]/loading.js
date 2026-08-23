'use client';

import LoadingDots from '@/components/LoadingDots';

export default function Loading() {
  return <LoadingDots title="Loading product details..." description="Fetching stock, transactions, and serial numbers" />;
}
