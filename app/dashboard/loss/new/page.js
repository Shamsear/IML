import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getRecentDirectSellers } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DamageClient from '../../damage/DamageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Report Loss - Inventory System',
  description: 'Log missing or lost warehouse inventory items',
};

export default async function NewLossPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/loss');
  }

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
