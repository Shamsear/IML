import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import DamageClient from '@/app/dashboard/damage/DamageClient';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Edit Loss Report - Inventory System',
  description: 'Edit existing loss report and serial records',
};

export default async function EditLossPage({ params }) {
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
