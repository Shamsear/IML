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
  title: 'Edit Client Return - Inventory System',
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

  // Include CLIENT_RETURN, CLIENT_STOCK, or any brand/client involved transaction
  const clientReturnItems = initialItems.filter(t => 
    t.transactionType === 'CLIENT_RETURN' || 
    t.transactionType === 'CLIENT_STOCK' ||
    t.toEntityType === 'BRAND' || 
    t.toEntityType === 'CLIENT' ||
    t.fromEntityType === 'BRAND' || 
    t.fromEntityType === 'CLIENT'
  );

  const finalItems = clientReturnItems.length > 0 ? clientReturnItems : initialItems;

  const isReturnFromClient = finalItems.some(t => 
    t.fromEntityType === 'BRAND' || 
    t.fromEntityType === 'CLIENT' || 
    t.toEntityType === 'WAREHOUSE'
  );

  const initialBrandId = isReturnFromClient
    ? (finalItems[0].fromEntityId || finalItems[0].product?.brandId || '')
    : (finalItems[0].toEntityId || finalItems[0].product?.brandId || '');

  const initialReceivedBy = finalItems[0].receivedBy || '';
  const initialGlobalNotes = finalItems[0].notes || '';
  const initialSupervisorName = finalItems[0].deliverySupervisorId || '';
  const initialTransactionDate = finalItems[0].timestamp || '';

  return (
    <ClientReturnsClient 
      brands={brands}
      products={products}
      editMode={true}
      existingDn={decodedDn}
      isReturnFromClient={isReturnFromClient}
      initialBrandId={initialBrandId}
      initialItems={finalItems}
      initialGlobalNotes={initialGlobalNotes}
      initialSupervisorName={initialSupervisorName}
      initialReceivedBy={initialReceivedBy}
      initialTransactionDate={initialTransactionDate}
    />
  );
}
