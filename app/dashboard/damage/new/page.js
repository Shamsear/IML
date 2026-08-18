import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote } from '@/app/actions/transactions';
import DamageClient from '../DamageClient';

export const metadata = {
  title: 'New Damage Report - Inventory System',
  description: 'Log and report damaged/lost warehouse inventory items',
};

export default async function NewDamagePage({ searchParams }) {
  const params = await searchParams;
  const copyDn = params?.copyDn;

  const [products, brands, initialItems] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    copyDn ? getTransactionsByDeliveryNote(copyDn) : Promise.resolve([])
  ]);

  return (
    <DamageClient 
      products={products} 
      brands={brands} 
      initialItems={initialItems.length > 0 ? initialItems : null}
    />
  );
}
