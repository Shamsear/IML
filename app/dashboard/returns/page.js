import { prisma } from '@/lib/prisma';
import ReturnsClient from './ReturnsClient';
import { Suspense } from 'react';

export const revalidate = 0;


export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Returns Hub',
};

function ReturnsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-14 bg-surface-elevated/40 rounded-xl w-64" />
      <div className="h-10 bg-surface-elevated/30 rounded-xl w-72" />
      <div className="h-96 bg-surface-elevated/20 rounded-2xl" />
    </div>
  );
}

export default async function ReturnsPage({ searchParams }) {
  const params = await searchParams;

  let rawTransactions = [];
  let stores = [];
  let pastReturns = [];
  let supervisors = [];

  try {
    [rawTransactions, stores, pastReturns, supervisors] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: {
          transactionType: { in: ['ISSUE', 'OUTBOUND'] },
          OR: [
            { returnStatus: null },
            { returnStatus: { notIn: ['RETURNED', 'USED'] } }
          ],
          product: {
            OR: [
              { isReturnable: true },
              { isDisposable: false },
              { category: { contains: 'UNIFORM', mode: 'insensitive' } },
              { category: { contains: 'Uniform', mode: 'insensitive' } },
              { name: { contains: 'Uniform', mode: 'insensitive' } },
              { name: { contains: 'Shirt', mode: 'insensitive' } },
              { name: { contains: 'T-Shirt', mode: 'insensitive' } },
              { name: { contains: 'Cap', mode: 'insensitive' } },
              { name: { contains: 'Apron', mode: 'insensitive' } },
              { name: { contains: 'Vest', mode: 'insensitive' } }
            ]
          }
        },
        select: {
          id: true,
          quantity: true,
          returnedQty: true,
          returnStatus: true,
          deliveryNote: true,
          timestamp: true,
          toEntityType: true,
          toEntityId: true,
          notes: true,
          deliverySupervisorId: true,
          product: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              isReturnable: true,
              isDisposable: true,
              isSerialized: true,
              category: true,
              brandId: true,
              brand: { select: { id: true, name: true } }
            }
          },
          deliverySupervisor: {
            select: { id: true, name: true }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 500,
      }),
      prisma.store.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.inventoryTransaction.findMany({
        where: { transactionType: 'RETURN' },
        select: {
          id: true,
          quantity: true,
          timestamp: true,
          deliveryNote: true,
          transactionType: true,
          fromEntityType: true,
          fromEntityId: true,
          notes: true,
          deliverySupervisorId: true,
          product: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              brandId: true,
              brand: { select: { id: true, name: true } }
            }
          },
          deliverySupervisor: {
            select: { id: true, name: true }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 500
      }),
      prisma.supervisor.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
    ]);
  } catch (err) {
    console.error('Error fetching returns page data:', err);
  }

  // Extract original transaction IDs from notes for past returns if deliverySupervisor is missing
  const missingSupervisorTxIds = [];
  pastReturns.forEach(tx => {
    if (!tx.deliverySupervisor && tx.notes) {
      const match = tx.notes.match(/from Outbound ([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        missingSupervisorTxIds.push(match[1]);
      }
    }
  });

  let origSupervisorMap = {};
  if (missingSupervisorTxIds.length > 0) {
    try {
      const origTxs = await prisma.inventoryTransaction.findMany({
        where: { id: { in: missingSupervisorTxIds } },
        select: {
          id: true,
          deliverySupervisor: { select: { id: true, name: true } }
        }
      });
      origTxs.forEach(ot => {
        if (ot.deliverySupervisor) {
          origSupervisorMap[ot.id] = ot.deliverySupervisor;
        }
      });
    } catch (e) {
      console.error('Error fetching historical supervisor details:', e);
    }
  }

  const enrichedPastReturns = pastReturns.map(tx => {
    if (tx.deliverySupervisor) return tx;
    const match = tx.notes?.match(/from Outbound ([a-zA-Z0-9-]+)/);
    if (match && match[1] && origSupervisorMap[match[1]]) {
      return { ...tx, deliverySupervisor: origSupervisorMap[match[1]] };
    }
    return tx;
  });

  const transactions = rawTransactions.filter(t => 
    (t.quantity - (t.returnedQty || 0)) > 0
  );

  return (
    <Suspense fallback={<ReturnsLoading />}>
      <ReturnsClient
        transactions={transactions}
        stores={stores}
        pastReturns={enrichedPastReturns}
        supervisors={supervisors}
        initialTab={params?.tab}
        initialDN={params?.dn}
      />
    </Suspense>
  );
}
