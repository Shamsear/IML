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
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            imageUrl: true,
            category: true,
            isReturnable: true,
            isDisposable: true,
            isSerialized: true,
            brandId: true,
            brand: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.store.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        OR: [
          { transactionType: 'USED' },
          { deliveryNote: { startsWith: 'USD-' } },
          { notes: { contains: 'Marked as Used from Outbound' } }
        ]
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            imageUrl: true,
            category: true,
            brandId: true,
            brand: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
    })
  ]);

  const transactions = rawTransactions.filter(t => (t.quantity - (t.returnedQty || 0)) > 0);

  return <UsedClient transactions={transactions} stores={stores} pastUsed={pastUsed} />;
}
