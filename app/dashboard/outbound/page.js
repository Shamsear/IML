import { prisma } from '@/lib/prisma';
import OutboundLedgerClient from './OutboundLedgerClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Outbound Dispatches Ledger - Inventory System',
  description: 'Log and review outbound dispatches and allocations',
};

function OutboundLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-14 bg-surface-elevated/40 rounded-xl w-64" />
      <div className="h-10 bg-surface-elevated/30 rounded-xl w-72" />
      <div className="h-96 bg-surface-elevated/20 rounded-2xl" />
    </div>
  );
}

export default async function OutboundPage({ searchParams }) {
  const params = await searchParams;
  const initialPage = parseInt(params?.page || '1', 10);
  const initialTab = params?.tab || 'transactions';

  let transactions = [];
  let stores = [];
  let supervisors = [];
  let staffList = [];

  try {
    [transactions, stores, supervisors, staffList] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: {
          transactionType: { in: ['ISSUE', 'OUTBOUND'] },
        },
        select: {
          id: true,
          transactionType: true,
          toEntityType: true,
          toEntityId: true,
          fromEntityType: true,
          fromEntityId: true,
          quantity: true,
          deliveryNote: true,
          deliverySupervisorId: true,
          timestamp: true,
          notes: true,
          product: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              brandId: true,
              isReturnable: true,
              isDisposable: true,
              brand: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          deliverySupervisor: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 1000,
      }),
      prisma.store.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.supervisor.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.staff.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
    ]);
  } catch (err) {
    console.error('Error fetching outbound ledger data:', err);
  }

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });

  const supervisorNames = {};
  supervisors.forEach(s => { supervisorNames[s.id] = s.name; });

  return (
    <Suspense fallback={<OutboundLoading />}>
      <OutboundLedgerClient
        transactions={transactions}
        entityNames={entityNames}
        stores={stores}
        supervisorNames={supervisorNames}
        initialPage={initialPage}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
