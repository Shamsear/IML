import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getRecentDirectSellers } from '@/app/actions/transactions';
import DamageClient from '../../damage/DamageClient';

export const metadata = {
  title: 'Report Loss - Inventory System',
  description: 'Log missing or lost warehouse inventory items',
};

export default async function NewLossPage() {
  const [products, brands, stores, directSellers] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    getStores(),
    getRecentDirectSellers()
  ]);

  return (
    <DamageClient
      products={products}
      brands={brands}
      stores={stores}
      directSellers={directSellers}
      lockedType="LOST"
    />
  );
}
