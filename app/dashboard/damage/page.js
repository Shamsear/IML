import { prisma } from '@/lib/prisma';
import DamageLedgerClient from './DamageLedgerClient';

export const metadata = {
  title: 'Damage Ledger - Inventory System',
  description: 'Review and log stock damages',
};

export default async function DamagePage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  const whereClause = { transactionType: 'DAMAGE' };

  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: whereClause,
      select: {
        id: true,
        transactionType: true,
        quantity: true,
        fromEntityType: true,
        fromEntityId: true,
        timestamp: true,
        notes: true,
        deliveryNote: true,
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            category: true,
            brandId: true,
            brand: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    }),
    prisma.inventoryTransaction.count({ where: whereClause })
  ]);

  const uniqueStoreIds = new Set();
  const uniqueSupervisorIds = new Set();
  const uniqueStaffIds = new Set();

  transactions.forEach(t => {
    if (t.fromEntityType === 'STORE' && t.fromEntityId) uniqueStoreIds.add(t.fromEntityId);
    if (t.toEntityType === 'STORE' && t.toEntityId) uniqueStoreIds.add(t.toEntityId);
    if (t.fromEntityType === 'SUPERVISOR' && t.fromEntityId) uniqueSupervisorIds.add(t.fromEntityId);
    if (t.toEntityType === 'SUPERVISOR' && t.toEntityId) uniqueSupervisorIds.add(t.toEntityId);
    if (t.fromEntityType === 'STAFF' && t.fromEntityId) uniqueStaffIds.add(t.fromEntityId);
    if (t.toEntityType === 'STAFF' && t.toEntityId) uniqueStaffIds.add(t.toEntityId);
  });

  const [stores, supervisors, staffList] = await Promise.all([
    uniqueStoreIds.size > 0 ? prisma.store.findMany({ where: { id: { in: Array.from(uniqueStoreIds) } }, select: { id: true, name: true } }) : Promise.resolve([]),
    uniqueSupervisorIds.size > 0 ? prisma.supervisor.findMany({ where: { id: { in: Array.from(uniqueSupervisorIds) } }, select: { id: true, name: true } }) : Promise.resolve([]),
    uniqueStaffIds.size > 0 ? prisma.staff.findMany({ where: { id: { in: Array.from(uniqueStaffIds) } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });

  // Format timestamps for serialization
  const formattedTransactions = transactions.map(tx => ({
    ...tx,
    timestamp: tx.timestamp.toISOString(),
  }));

  return (
    <DamageLedgerClient
      transactions={formattedTransactions}
      totalCount={totalCount}
      initialPage={page}
      pageSize={pageSize}
      entityNames={entityNames}
    />
  );
}
