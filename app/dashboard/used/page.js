import { prisma } from '@/lib/prisma';
import UsedClient from './UsedClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Mark as Used / Consumed',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsedPage() {
  const [rawTransactions, stores, pastUsed] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['ISSUE', 'OUTBOUND'] },
        product: { isDisposable: true },
        OR: [
          { returnStatus: null },
          { returnStatus: { notIn: ['RETURNED', 'USED'] } }
        ]
      },
      include: {
        product: { select: { id: true, name: true, itemCode: true, imageUrl: true, isReturnable: true, isDisposable: true, isSerialized: true, brand: { select: { name: true } } } }
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.inventoryTransaction.findMany({
      where: {
        OR: [
          { transactionType: 'USED' },
          { deliveryNote: { startsWith: 'USD-' } },
          { notes: { contains: 'Marked as Used from Outbound' } }
        ]
      },
      include: {
        product: { select: { id: true, name: true, itemCode: true, imageUrl: true, brand: { select: { name: true } } } }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    })
  ]);

  const transactions = rawTransactions.filter(t => (t.quantity - (t.returnedQty || 0)) > 0);

  return <UsedClient transactions={transactions} stores={stores} pastUsed={pastUsed} />;
}
