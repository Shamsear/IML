import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import { getTransactionsByDeliveryNote, getTransactionById } from '@/app/actions/transactions';
import OutboundClient from '../OutboundClient';

export const metadata = {
  title: 'New Outbound Dispatch - Inventory System',
  description: 'Dispatch items from warehouse to stores or clients',
};

export default async function NewOutboundPage({ searchParams }) {
  const params = await searchParams;
  const copyDn = params?.copyDn;
  const copyTxId = params?.copyTxId;

  const [
    products, 
    stores, 
    brands,
    staff,
    supervisors,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getStores(),
    getBrands(),
    getStaff(),
    getSupervisors(),
    copyDn
      ? getTransactionsByDeliveryNote(copyDn)
      : copyTxId
        ? getTransactionById(copyTxId).then(tx => (tx ? [tx] : []))
        : Promise.resolve([])
  ]);

  const initialDestinationType = initialItems.length > 0 ? initialItems[0].toEntityType : 'STORE';
  const initialDestinationId = initialItems.length > 0 ? initialItems[0].toEntityId : '';

  return (
    <OutboundClient 
      products={products} 
      stores={stores} 
      brands={brands}
      staff={staff}
      supervisors={supervisors}
      initialItems={initialItems.length > 0 ? initialItems : null}
      initialDestinationType={initialDestinationType}
      initialDestinationId={initialDestinationId}
    />
  );
}
