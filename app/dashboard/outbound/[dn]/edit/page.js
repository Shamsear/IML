import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import { getTransactionsByDeliveryNote, getRecentDirectSellers } from '@/app/actions/transactions';
import OutboundClient from '../../OutboundClient';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Outbound Dispatch - Inventory System',
  description: 'Edit existing outbound dispatch',
};

export default async function EditOutboundPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/outbound');
  }

  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    stores, 
    brands,
    supervisors,
    directSellers,
    staff,
    initialItems
  ] = await Promise.all([
    getProductsSlim().catch(err => { console.error('Error fetching products:', err); return []; }),
    getStores().catch(err => { console.error('Error fetching stores:', err); return []; }),
    getBrands().catch(err => { console.error('Error fetching brands:', err); return []; }),
    getSupervisors().catch(err => { console.error('Error fetching supervisors:', err); return []; }),
    getRecentDirectSellers().catch(err => { console.error('Error fetching direct sellers:', err); return []; }),
    getStaff().catch(err => { console.error('Error fetching staff:', err); return []; }),
    getTransactionsByDeliveryNote(decodedDn).catch(err => { console.error('Error fetching transactions:', err); return []; })
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
      staffList={staff}
      initialItems={issueItems}
      initialDestinationType={initialDestinationType}
      initialDestinationId={initialDestinationId}
      initialDeliverySupervisorId={initialSupervisorId}
      editMode={true}
      existingDn={decodedDn}
    />
  );
}
