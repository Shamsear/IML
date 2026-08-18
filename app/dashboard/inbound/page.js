import { prisma } from '@/lib/prisma';
import InboundLedgerClient from './InboundLedgerClient';

export const metadata = {
  title: 'Inbound Receipts Ledger - Inventory System',
  description: 'Log and review inbound inventory receipts',
};

export default async function InboundPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all RECEIVE or RETURN transactions with skip and take
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
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
        product: {
          select: {
            id: true,
            name: true,
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({
      where: {
        transactionType: { in: ['RECEIVE', 'RETURN'] },
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve source names in memory using selective ID queries
  const uniqueStoreIds = new Set();
  const uniqueStaffIds = new Set();
  const uniqueSupervisorIds = new Set();

  transactions.forEach(t => {
    if (t.fromEntityType === 'STORE' && t.fromEntityId) uniqueStoreIds.add(t.fromEntityId);
    if (t.toEntityType === 'STORE' && t.toEntityId) uniqueStoreIds.add(t.toEntityId);
    if (t.fromEntityType === 'STAFF' && t.fromEntityId) uniqueStaffIds.add(t.fromEntityId);
    if (t.toEntityType === 'STAFF' && t.toEntityId) uniqueStaffIds.add(t.toEntityId);
    if (t.fromEntityType === 'SUPERVISOR' && t.fromEntityId) uniqueSupervisorIds.add(t.fromEntityId);
    if (t.toEntityType === 'SUPERVISOR' && t.toEntityId) uniqueSupervisorIds.add(t.toEntityId);
  });

  const [stores, supervisors, staffList] = await Promise.all([
    prisma.store.findMany({
      where: { id: { in: Array.from(uniqueStoreIds) } },
      select: { id: true, name: true }
    }),
    prisma.supervisor.findMany({
      where: { id: { in: Array.from(uniqueSupervisorIds) } },
      select: { id: true, name: true }
    }),
    prisma.staff.findMany({
      where: { id: { in: Array.from(uniqueStaffIds) } },
      select: { id: true, name: true }
    }),
  ]);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });

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
