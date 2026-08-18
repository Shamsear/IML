import { getProductsSlim } from '@/app/actions/products';
import { getRecentReceivers, getRecentSuppliers, getTransactionsByDeliveryNote, getTransactionById } from '@/app/actions/transactions';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import InboundClient from '../InboundClient';

export const metadata = {
  title: 'New Inbound Receipt - Inventory System',
  description: 'Log inbound supplier inventory receipts',
};

export default async function NewInboundPage({ searchParams }) {
  const params = await searchParams;
  const copyDn = params?.copyDn;
  const copyTxId = params?.copyTxId;

  const [
    products,
    recentReceivers,
    recentSuppliers,
    brands,
    stores,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getRecentReceivers(),
    getRecentSuppliers(),
    getBrands(),
    getStores(),
    copyDn
      ? getTransactionsByDeliveryNote(copyDn)
      : copyTxId
        ? getTransactionById(copyTxId).then(tx => (tx ? [tx] : []))
        : Promise.resolve([])
  ]);

  // Try to find a supplier name from the first item to prefill
  const initialSupplier = initialItems.length > 0 ? initialItems[0].fromEntityId : '';

  return (
    <InboundClient 
      products={products} 
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
      brands={brands}
      stores={stores}
      initialItems={initialItems.length > 0 ? initialItems : null}
      initialSupplier={initialSupplier}
    />
  );
}
