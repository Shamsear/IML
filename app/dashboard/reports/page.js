import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // Fetch brands, products, ledger aggregates, and serial aggregates concurrently
  const [brands, products, aggregates, serialAggs] = await Promise.all([
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
        isSerialized: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' }
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType', 'returnStatus'],
      _sum: {
        quantity: true,
      },
    }),
    prisma.productSerialNumber.groupBy({
      by: ['productId', 'status', 'currentLocationType'],
      _count: { id: true }
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

  const serialsMap = new Map();
  serialAggs.forEach(item => {
    if (!serialsMap.has(item.productId)) {
      serialsMap.set(item.productId, {
        warehouse: 0,
        issued: 0,
        used: 0,
        withClient: 0,
        damage: 0,
        lost: 0
      });
    }
    const stats = serialsMap.get(item.productId);
    const count = item._count.id || 0;
    const status = item.status;
    const loc = item.currentLocationType;

    if (status === 'AVAILABLE') {
      if (loc === 'STORE') {
        stats.issued += count;
      } else {
        stats.warehouse += count;
      }
    } else if (status === 'WITH_CLIENT' || loc === 'CLIENT' || loc === 'BRAND') {
      stats.withClient += count;
    } else if (status === 'DAMAGED') {
      stats.damage += count;
    } else if (status === 'LOST') {
      stats.lost += count;
    } else if (status === 'USED' || loc === 'STAFF') {
      stats.used += count;
    }
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
      serialStats: product.isSerialized ? (serialsMap.get(product.id) || null) : null,
    };
  });

  return (
    <ReportsClient 
      initialProducts={productsWithTransactions} 
      brands={brands} 
    />
  );
}
