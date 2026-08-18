import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import DamageClient from '../../damage/DamageClient';

export const metadata = {
  title: 'Report Loss - Inventory System',
  description: 'Log missing or lost warehouse inventory items',
};

export default async function NewLossPage() {
  const [products, brands] = await Promise.all([
    getProductsSlim(),
    getBrands(),
  ]);

  return (
    <DamageClient
      products={products}
      brands={brands}
      lockedType="LOST"
    />
  );
}
