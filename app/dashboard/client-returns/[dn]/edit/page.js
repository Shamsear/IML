import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote } from '@/app/actions/transactions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import ClientReturnsClient from '../../ClientReturnsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Stock Returned to Client - Inventory System',
  description: 'Edit existing client return gate pass and items',
};

export default async function EditClientReturnPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/client-returns');
  }

  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    brands,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  const clientReturnItems = initialItems.filter(t => t.transactionType === 'CLIENT_RETURN');
  if (clientReturnItems.length === 0) {
    // Gracefully route store returns or generic transactions to the transaction editor
    const targetTx = initialItems.find(t => t.transactionType === 'RETURN') || initialItems[0];
    if (targetTx) {
      redirect(`/dashboard/transactions/${encodeURIComponent(targetTx.rawTxId || decodedDn)}/edit`);
    }
    notFound();
  }

  const initialBrandId = clientReturnItems[0].toEntityId || clientReturnItems[0].product?.brandId || '';
  const initialReceivedBy = clientReturnItems[0].receivedBy || '';
  const initialGlobalNotes = clientReturnItems[0].notes || '';
  const initialSupervisorName = clientReturnItems[0].deliverySupervisorId || '';
  const initialTransactionDate = clientReturnItems[0].timestamp || '';

  return (
    <ClientReturnsClient 
      brands={brands}
      products={products}
      editMode={true}
      existingDn={decodedDn}
      initialBrandId={initialBrandId}
      initialItems={clientReturnItems}
      initialGlobalNotes={initialGlobalNotes}
      initialSupervisorName={initialSupervisorName}
      initialReceivedBy={initialReceivedBy}
      initialTransactionDate={initialTransactionDate}
    />
  );
}
