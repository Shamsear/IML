import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote } from '@/app/actions/transactions';
import InboundClient from '../../InboundClient';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Edit Inbound Receipt - Inventory System',
  description: 'Edit existing inbound receipt',
};

export default async function EditInboundPage({ params }) {
  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    stores, 
    brands,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getStores(),
    getBrands(),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  // Filter only RECEIVE transactions just in case
  const receiveItems = initialItems.filter(t => t.transactionType === 'RECEIVE');
  
  if (receiveItems.length === 0) {
    notFound();
  }

  const initialSupplier = receiveItems[0].fromEntityId || '';

  return (
    <InboundClient 
      products={products} 
      stores={stores} 
      brands={brands}
      initialItems={receiveItems}
      initialSupplier={initialSupplier}
      editMode={true}
      existingDn={decodedDn}
    />
  );
}
