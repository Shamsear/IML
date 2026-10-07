import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DamageClient from '@/app/dashboard/damage/DamageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Mark as Used / Consumed - Inventory System',
  description: 'Log and record used or consumed items directly from warehouse stock or store placements',
};

export default async function NewUsedPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/used');
  }

  const params = await searchParams;
  const copyDn = params?.copyDn;

  const [products, brands, stores, directSellers, initialItems] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    getStores(),
    getRecentDirectSellers(),
    copyDn ? getTransactionsByDeliveryNote(copyDn) : Promise.resolve([])
  ]);

  return (
    <DamageClient 
      products={products} 
      brands={brands} 
      stores={stores}
      directSellers={directSellers}
      initialItems={initialItems.length > 0 ? initialItems : null}
      lockedType="USED"
      initialFromType="WAREHOUSE"
    />
  );
}
