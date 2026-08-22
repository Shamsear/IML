import { prisma } from '@/lib/prisma';
import ReturnsClient from './ReturnsClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Returns Hub',
};

export default async function ReturnsPage() {
  const [rawTransactions, stores, pastReturns] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['ISSUE', 'OUTBOUND'] },
        product: { isReturnable: true },
        OR: [
          { returnStatus: null },
          { returnStatus: { notIn: ['RETURNED', 'USED'] } }
        ]
      },
      include: {
        product: { select: { id: true, name: true, isReturnable: true, isDisposable: true, isSerialized: true, category: true } }
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.inventoryTransaction.findMany({
      where: { transactionType: 'RETURN' },
      include: {
        product: { select: { id: true, name: true, brand: { select: { name: true } } } }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    })
  ]);

  const transactions = rawTransactions.filter(t => 
    (t.quantity - (t.returnedQty || 0)) > 0 &&
    (!t.product?.category || !t.product.category.toUpperCase().includes('UNIFORM'))
  );

  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <ReturnsClient transactions={transactions} stores={stores} pastReturns={pastReturns} />
    </Suspense>
  );
}

