import { prisma } from '@/lib/prisma';
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
    stores,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    prisma.store.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, location: true }
    }),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  // Strictly filter for client/brand transactions
  const clientReturnItems = initialItems.filter(t => 
    t.transactionType === 'CLIENT_RETURN' || 
    t.transactionType === 'CLIENT_STOCK' ||
    t.toEntityType === 'BRAND' || 
    t.toEntityType === 'CLIENT' ||
    t.fromEntityType === 'BRAND' || 
    t.fromEntityType === 'CLIENT'
  );

  if (clientReturnItems.length === 0) {
    // If this is an outlet/store return, send it to the store returns editor
    const isStoreReturn = initialItems.some(t => t.transactionType === 'RETURN' && t.fromEntityType === 'STORE');
    if (isStoreReturn) {
      redirect(`/dashboard/returns/${encodeURIComponent(decodedDn)}/edit`);
    }
    notFound();
  }

  const isReturnFromClient = clientReturnItems.some(t => 
    t.fromEntityType === 'BRAND' || 
    t.fromEntityType === 'CLIENT' || 
    t.deliveryNote?.startsWith('CRR-')
  );

  const initialBrandId = isReturnFromClient
    ? (clientReturnItems[0].fromEntityId || clientReturnItems[0].product?.brandId || '')
    : (clientReturnItems[0].toEntityId || clientReturnItems[0].product?.brandId || '');

  // Extract store if noted in notes e.g. [Store: Store Name]
  const storeMatch = clientReturnItems[0].notes?.match(/\[Store:\s*([^\]]+)\]/i);
  const matchedStoreName = storeMatch ? storeMatch[1].trim().toLowerCase() : '';
  const initialStore = stores.find(s => s.name.toLowerCase() === matchedStoreName);
  const initialStoreId = initialStore ? initialStore.id : '';

  const initialReceivedBy = clientReturnItems[0].receivedBy || '';
  const initialGlobalNotes = clientReturnItems[0].notes ? clientReturnItems[0].notes.replace(/\[Store:\s*[^\]]+\]/gi, '').trim() : '';
  const initialSupervisorName = clientReturnItems[0].deliverySupervisorId || '';
  const initialTransactionDate = clientReturnItems[0].timestamp || '';

  return (
    <ClientReturnsClient 
      brands={brands}
      products={products}
      stores={stores}
      editMode={true}
      existingDn={decodedDn}
      isReturnFromClient={isReturnFromClient}
      initialBrandId={initialBrandId}
      initialStoreId={initialStoreId}
      initialItems={clientReturnItems}
      initialGlobalNotes={initialGlobalNotes}
      initialSupervisorName={initialSupervisorName}
      initialReceivedBy={initialReceivedBy}
      initialTransactionDate={initialTransactionDate}
    />
  );
}
