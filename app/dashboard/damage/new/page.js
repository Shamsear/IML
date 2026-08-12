import { getProducts } from '@/app/actions/products';
import DamageClient from '../DamageClient';

export const metadata = {
  title: 'New Damage Report - Inventory System',
  description: 'Log and report damaged/lost warehouse inventory items',
};

export default async function NewDamagePage() {
  const products = await getProducts();

  return (
    <DamageClient products={products} />
  );
}
