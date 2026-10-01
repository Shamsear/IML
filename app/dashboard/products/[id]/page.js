import { notFound } from 'next/navigation';
import { getProductDetail } from '@/app/actions/products';
import ProductDetailClient from './ProductDetailClient';

export const metadata = {
  title: 'Product Detail - Inventory System',
};

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
