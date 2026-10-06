import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import InboundLedgerClient from './InboundLedgerClient';

export const metadata = {
  title: 'Inbound Receipts Ledger - Inventory System',
  description: 'Log and review inbound inventory receipts',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InboundPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all RECEIVE or RETURN transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: { in: ['RECEIVE', 'RETURN'] },
    },
    select: {
      id: true,
      transactionType: true,
      fromEntityType: true,
      fromEntityId: true,
      quantity: true,
      deliveryNote: true,
      timestamp: true,
      notes: true,
      receivedBy: true,
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          imageUrl: true,
          brandId: true,
          brand: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  const totalCount = transactions.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const [stores, supervisors, staffList, brands] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
  ]);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });
  brands.forEach(b => { entityNames[b.id] = b.name; });
  return (
    <InboundLedgerClient
      transactions={transactions}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      entityNames={entityNames}
    />
  );
}
