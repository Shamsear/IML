import { getProductsSlim } from '@/app/actions/products';
import RebrandClient from '../RebrandClient';

export const metadata = {
  title: 'New Stock Rebranding - Inventory System',
  description: 'Rebrand existing stock items into another product catalog entry',
};

export default async function NewRebrandPage() {
  const products = await getProductsSlim();

  return (
    <RebrandClient products={products} />
  );
}
