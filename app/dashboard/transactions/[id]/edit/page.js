import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import EditTransactionClient from './EditTransactionClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Transaction - Inventory System',
  description: 'Modify an existing inventory transaction',
};

export default async function EditTransactionPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/transactions');
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // 1. Fetch transaction with serials (matches either UUID or deliveryNote)
  const transaction = await prisma.inventoryTransaction.findFirst({
    where: {
      OR: [
        { id: decodedId },
        { deliveryNote: decodedId }
      ]
    },
    include: {
      serialNumbers: {
        include: {
          serialNumber: true
        }
      }
    }
  });

  if (!transaction) {
    notFound();
  }

  // 2. Fetch metadata needed for dropdowns
  const [products, stores] = await Promise.all([
    getProductsSlim(),
    getStores()
  ]);

  return (
    <EditTransactionClient 
      transaction={transaction}
      products={products}
      stores={stores}
    />
  );
}
