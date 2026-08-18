import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import EditTransactionClient from './EditTransactionClient';

export const metadata = {
  title: 'Edit Transaction - Inventory System',
  description: 'Modify an existing inventory transaction',
};

export default async function EditTransactionPage({ params }) {
  const { id } = await params;

  // 1. Fetch transaction with serials
  const transaction = await prisma.inventoryTransaction.findUnique({
    where: { id },
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
