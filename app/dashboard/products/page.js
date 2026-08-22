import { Suspense } from 'react';
import { getProducts } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import ProductsClient from './ProductsClient';

export default async function ProductsPage() {
  const [products, brands, stores] = await Promise.all([
    getProducts(),
    getBrands(),
    getStores(),
  ]);

  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <ProductsClient 
        initialProducts={products} 
        brands={brands} 
        stores={stores}
      />
    </Suspense>
  );
}
