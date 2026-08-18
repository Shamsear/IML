import { prisma } from '@/lib/prisma';
import OutboundLedgerClient from './OutboundLedgerClient';

export const metadata = {
  title: 'Outbound Dispatches Ledger - Inventory System',
  description: 'Log and review outbound dispatches and allocations',
};

export default async function OutboundPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all ISSUE transactions with skip and take
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'ISSUE',
      },
      select: {
        id: true,
        transactionType: true,
        toEntityType: true,
        toEntityId: true,
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
        transactionType: 'ISSUE',
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve destination names in memory
  // Outlets, staff, and supervisors can be matched by fromEntityId / toEntityId
  const [stores, supervisors, staffList] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staffList.forEach(s => { entityNames[s.id] = s.name; });

  return <OutboundLedgerClient transactions={transactions} totalCount={totalCount} totalPages={totalPages} page={page} entityNames={entityNames} />;
}
