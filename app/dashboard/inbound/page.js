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

  // Resolve source names in memory (mostly stores for returns)
  const [stores, supervisors, staffList] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
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
