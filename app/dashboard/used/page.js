import { prisma } from '@/lib/prisma';
import UsedClient from './UsedClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Mark as Used / Consumed',
};

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
        product: { select: { id: true, name: true, isReturnable: true, isDisposable: true, isSerialized: true } }
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.inventoryTransaction.findMany({
      where: { transactionType: 'USED' },
      include: {
        product: { select: { id: true, name: true, brand: { select: { name: true } } } }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    })
  ]);

  const transactions = rawTransactions.filter(t => (t.quantity - (t.returnedQty || 0)) > 0);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UsedClient transactions={transactions} stores={stores} pastUsed={pastUsed} />
    </Suspense>
  );
}
