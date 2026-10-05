import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import DamageClient from '../../DamageClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Damage Report - Inventory System',
  description: 'Edit existing damage report and serial records',
};

export default async function EditDamagePage({ params }) {
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

  const damageItems = initialItems.filter(t => t.transactionType === 'DAMAGE' || t.transactionType === 'LOST');
  if (damageItems.length === 0) {
    notFound();
  }

  const initialFromType = damageItems[0].fromEntityType || 'WAREHOUSE';
  const initialFromId = damageItems[0].fromEntityId || '';

  return (
    <DamageClient 
      products={products} 
      stores={stores} 
      brands={brands}
      directSellers={directSellers}
      initialItems={damageItems}
      initialFromType={initialFromType}
      initialFromId={initialFromId}
      lockedType="DAMAGE"
      editMode={true}
      existingDn={decodedDn}
    />
  );
}
