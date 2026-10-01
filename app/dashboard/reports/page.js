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

  // Fetch brands, products, and ledger aggregates concurrently
  const [brands, products, aggregates] = await Promise.all([
    prisma.brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        itemCode: true,
        category: true,
        imageUrl: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' }
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType', 'returnStatus'],
      _sum: {
        quantity: true,
      },
    })
  ]);

  // Map database aggregates back to the products in the format the component expects
  const aggsMap = new Map();
  aggregates.forEach(agg => {
    if (!aggsMap.has(agg.productId)) {
      aggsMap.set(agg.productId, []);
    }
    aggsMap.get(agg.productId).push(agg);
  });

  const productsWithTransactions = products.map(product => {
    const productAggs = aggsMap.get(product.id) || [];
    const fakeTransactions = productAggs.map(agg => ({
      transactionType: agg.transactionType,
      quantity: agg._sum.quantity || 0,
      fromEntityType: agg.fromEntityType,
      toEntityType: agg.toEntityType,
      returnStatus: agg.returnStatus,
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
