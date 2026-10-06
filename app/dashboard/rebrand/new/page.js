import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RebrandClient from '../RebrandClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'New Stock Rebranding - Inventory System',
  description: 'Rebrand existing stock items into another product catalog entry',
};

export default async function NewRebrandPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/rebrand');
  }

  const [products, brands, stores] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    getStores()
  ]);

  return (
    <RebrandClient products={products} brands={brands} stores={stores} />
  );
}
