import { Suspense } from 'react';
import { getProducts } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductsPage() {
  const [products, brands, stores] = await Promise.all([
    getProducts(),
    getBrands(),
    getStores(),
  ]);

  return (
    <ProductsClient 
      initialProducts={products} 
      brands={brands} 
      stores={stores}
    />
  );
}
