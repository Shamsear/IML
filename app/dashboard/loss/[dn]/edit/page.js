import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import DamageClient from '@/app/dashboard/damage/DamageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Loss Report - Inventory System',
  description: 'Edit existing loss report and serial records',
};

export default async function EditLossPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/loss');
  }

  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    stores, 
    brands,
    directSellers,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getStores(),
    getBrands(),
    getRecentDirectSellers(),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  const lossItems = initialItems.filter(t => t.transactionType === 'LOST' || t.transactionType === 'DAMAGE');
  if (lossItems.length === 0) {
    notFound();
  }

  const initialFromType = lossItems[0].fromEntityType || 'WAREHOUSE';
  const initialFromId = lossItems[0].fromEntityId || '';

  return (
    <DamageClient 
      products={products} 
      stores={stores} 
      brands={brands}
      directSellers={directSellers}
      initialItems={lossItems}
      initialFromType={initialFromType}
      initialFromId={initialFromId}
      lockedType="LOST"
      editMode={true}
      existingDn={decodedDn}
    />
  );
}
