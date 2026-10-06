import { getReturnTransactionForEdit } from '@/app/actions/transactions';
import { getSupervisors } from '@/app/actions/supervisors';
import { getAvailableBarcodes } from '@/app/actions/products';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import EditReturnClient from './EditReturnClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Edit Return - Inventory System',
  description: 'Edit a return done, quantity, supervisor, and return remarks',
};

export default async function EditReturnPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/returns');
  }

  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [returnData, supervisors] = await Promise.all([
    getReturnTransactionForEdit(decodedDn),
    getSupervisors(),
  ]);

  if (!returnData || !returnData.returnTx) {
    notFound();
  }

  const { returnTx, parentTx, store, siblingTotal, maxReturnableQty, cleanNotes } = returnData;

  // If product is serialized, fetch available barcodes at source store to allow selecting/adjusting
  let availableStoreBarcodes = [];
  if (returnTx.product?.isSerialized && returnTx.fromEntityType === 'STORE' && returnTx.fromEntityId) {
    try {
      availableStoreBarcodes = await getAvailableBarcodes(returnTx.productId, 'STORE', returnTx.fromEntityId);
    } catch (e) {
      console.error('Error fetching available barcodes:', e);
    }
  }

  // Format serial numbers currently on this return transaction
  const currentSerials = (returnTx.serialNumbers || []).map(s => s.serialNumber?.barcode).filter(Boolean);

  return (
    <EditReturnClient
      returnTx={{
        ...returnTx,
        timestamp: returnTx.timestamp ? returnTx.timestamp.toISOString() : null,
      }}
      parentTx={parentTx ? {
        ...parentTx,
        timestamp: parentTx.timestamp ? parentTx.timestamp.toISOString() : null,
      } : null}
      store={store}
      siblingTotal={siblingTotal}
      maxReturnableQty={maxReturnableQty}
      cleanNotes={cleanNotes}
      supervisors={supervisors}
      availableStoreBarcodes={availableStoreBarcodes}
      currentSerials={currentSerials}
    />
  );
}
