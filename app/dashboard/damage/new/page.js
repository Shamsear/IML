import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DamageClient from '../DamageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'New Damage Report - Inventory System',
  description: 'Log and report damaged/lost warehouse inventory items',
};

export default async function NewDamagePage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/damage');
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
      lockedType="DAMAGE"
    />
  );
}
