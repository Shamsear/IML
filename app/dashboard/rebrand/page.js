import { prisma } from '@/lib/prisma';
import RebrandLedgerClient from './RebrandLedgerClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock Rebranding Ledger - Inventory System',
  description: 'Log and review stock rebranding campaigns',
};

function RebrandLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-14 bg-surface-elevated/40 rounded-xl w-64" />
      <div className="h-10 bg-surface-elevated/30 rounded-xl w-72" />
      <div className="h-96 bg-surface-elevated/20 rounded-2xl" />
    </div>
  );
}

export default async function RebrandPage({ searchParams }) {
  const params = await searchParams;
  const initialPage = parseInt(params?.page || '1', 10);

  let transactions = [];
  let totalCount = 0;
  let stores = [];
  let products = [];

  try {
    const [txs, count, storeList, prodList] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: {
          transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] },
        },
        select: {
          id: true,
          transactionType: true,
          fromEntityType: true,
          fromEntityId: true,
          toEntityType: true,
          toEntityId: true,
          quantity: true,
          deliveryNote: true,
          notes: true,
          returnStatus: true,
          returnedQty: true,
          returnNotes: true,
          timestamp: true,
          product: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              brand: { select: { id: true, name: true } }
            }
          },
          serialNumbers: {
            select: {
              serialNumber: { select: { barcode: true } }
            }
          }
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 500,
      }),
      prisma.inventoryTransaction.count({
        where: {
          transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] },
        }
      }),
      prisma.store.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          itemCode: true,
          brand: { select: { name: true } }
        },
        orderBy: { name: 'asc' }
      })
    ]);

    transactions = txs;
    totalCount = count;
    stores = storeList;
    products = prodList;
  } catch (err) {
    console.error('Error fetching rebrand transactions:', err);
  }

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });

  const formattedTransactions = transactions.map(tx => ({
    ...tx,
    timestamp: tx.timestamp ? tx.timestamp.toISOString() : new Date().toISOString(),
  }));

  return (
    <Suspense fallback={<RebrandLoading />}>
      <RebrandLedgerClient
        transactions={formattedTransactions}
        entityNames={entityNames}
        products={products}
        totalCount={totalCount}
        initialPage={initialPage}
      />
    </Suspense>
  );
}
