import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import RebrandClient from '../RebrandClient';

export const metadata = {
  title: 'New Stock Rebranding - Inventory System',
  description: 'Rebrand existing stock items into another product catalog entry',
};

export default async function NewRebrandPage() {
  const [products, brands, stores] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    getStores()
  ]);

  return (
    <RebrandClient products={products} brands={brands} stores={stores} />
  );
}
