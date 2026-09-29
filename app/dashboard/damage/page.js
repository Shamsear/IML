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
            brandId: true,
            brand: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({ where: whereClause })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const [stores, supervisors, staffList] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
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
      totalPages={totalPages}
      page={page}
      pageSize={pageSize}
      entityNames={entityNames}
    />
  );
}
