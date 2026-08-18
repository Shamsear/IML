import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getSupervisors } from '@/app/actions/supervisors';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import OutboundClient from '../../OutboundClient';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Edit Outbound Dispatch - Inventory System',
  description: 'Edit existing outbound dispatch',
};

export default async function EditOutboundPage({ params }) {
  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    stores, 
    brands,
    supervisors,
    directSellers,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getStores(),
    getBrands(),
    getSupervisors(),
    getRecentDirectSellers(),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  // Filter only ISSUE transactions just in case (we are editing outbound)
  const issueItems = initialItems.filter(t => t.transactionType === 'ISSUE');
  
  if (issueItems.length === 0) {
    notFound();
  }

  const initialDestinationType = issueItems[0].toEntityType || 'STORE';
  const initialDestinationId = issueItems[0].toEntityId || '';
  const initialSupervisorId = issueItems[0].deliverySupervisorId || '';

  return (
    <OutboundClient 
      products={products} 
      stores={stores} 
      brands={brands}
      directSellers={directSellers}
      supervisors={supervisors}
      initialItems={issueItems}
      initialDestinationType={initialDestinationType}
      initialDestinationId={initialDestinationId}
      initialDeliverySupervisorId={initialSupervisorId}
      editMode={true}
      existingDn={decodedDn}
    />
  );
}
