import { getUsedTransactionForEdit } from '@/app/actions/transactions';
import { getSupervisors } from '@/app/actions/supervisors';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import EditUsedClient from './EditUsedClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Edit Consumed Item - Inventory System',
  description: 'Edit a consumed / used record, quantity, supervisor, and remarks',
};

export default async function EditUsedPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/used');
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const [usedData, supervisors] = await Promise.all([
    getUsedTransactionForEdit(decodedId),
    getSupervisors(),
  ]);

  if (!usedData || !usedData.usedTx) {
    notFound();
  }

  const { usedTx, parentTx, store, siblingTotal, maxUsableQty, cleanNotes } = usedData;

  return (
    <EditUsedClient
      usedTx={{
        ...usedTx,
        timestamp: usedTx.timestamp ? usedTx.timestamp.toISOString() : null,
      }}
      parentTx={parentTx ? {
        ...parentTx,
        timestamp: parentTx.timestamp ? parentTx.timestamp.toISOString() : null,
      } : null}
      store={store}
      siblingTotal={siblingTotal}
      maxUsableQty={maxUsableQty}
      cleanNotes={cleanNotes}
      supervisors={supervisors}
    />
  );
}
