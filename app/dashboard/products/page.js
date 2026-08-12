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
    <ProductsClient 
      initialProducts={products} 
      brands={brands} 
      stores={stores}
    />
  );
}
