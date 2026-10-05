import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote } from '@/app/actions/transactions';
import ClientReturnsClient from '../../ClientReturnsClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Stock Returned to Client - Inventory System',
  description: 'Edit existing client return gate pass and items',
};

export default async function EditClientReturnPage({ params }) {
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
