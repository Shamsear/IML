import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // Fetch all brands for the filter dropdown
  const brands = await prisma.brand.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  // Fetch all products and their brand details
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      brandId: true,
      brand: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' }
  });

  // Aggregate ledger quantities grouped by product and transaction parameters at database level
  const aggregates = await prisma.inventoryTransaction.groupBy({
    by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType'],
    _sum: {
      quantity: true,
    },
  });

  // Map database aggregates back to the products in the format the component expects
  const productsWithTransactions = products.map(product => {
    const productAggs = aggregates.filter(a => a.productId === product.id);
    const fakeTransactions = productAggs.map(agg => ({
      transactionType: agg.transactionType,
      quantity: agg._sum.quantity || 0,
      fromEntityType: agg.fromEntityType,
      toEntityType: agg.toEntityType,
    }));

    return {
      ...product,
      transactions: fakeTransactions,
    };
  });

  return (
    <ReportsClient 
      initialProducts={productsWithTransactions} 
      brands={brands} 
    />
  );
}
