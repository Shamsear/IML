import { prisma } from '@/lib/prisma';
import UsedClient from './UsedClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Mark as Used / Consumed',
};

export default async function UsedPage() {
  const [rawTransactions, stores] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['ISSUE', 'OUTBOUND'] },
        returnStatus: { notIn: ['RETURNED', 'USED'] },
        product: { isDisposable: true },
      },
      include: {
        product: { select: { id: true, name: true, isReturnable: true, isDisposable: true, isSerialized: true } }
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.store.findMany({ select: { id: true, name: true } }),
  ]);

  const transactions = rawTransactions.filter(t => (t.quantity - (t.returnedQty || 0)) > 0);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UsedClient transactions={transactions} stores={stores} />
    </Suspense>
  );
}
