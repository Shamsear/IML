import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProductDetail } from '@/app/actions/products';
import ProductDetailClient from './ProductDetailClient';
import LoadingDots from '@/components/LoadingDots';

export const metadata = {
  title: 'Product Detail - Inventory System',
};

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  return (
    <Suspense fallback={<LoadingDots title="Loading product details..." description="Fetching stock, transactions, and serial numbers" />}>
      <ProductDetailClient product={product} />
    </Suspense>
  );
}
