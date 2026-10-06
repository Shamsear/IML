import { prisma } from '@/lib/prisma';
import ClientReturnsLedgerClient from './ClientReturnsLedgerClient';

export const metadata = {
  title: 'With Client Ledger - Inventory System',
  description: 'Review stock items returned to client brand owners',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientReturnsPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  const whereClause = {
    OR: [
      { transactionType: { in: ['CLIENT_STOCK', 'CLIENT_RETURN'] } },
      { toEntityType: { in: ['CLIENT', 'BRAND'] } },
      { fromEntityType: { in: ['CLIENT', 'BRAND'] } }
    ]
  };

  // Query client transactions (take up to 1000 to group by gate pass accurately)
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: whereClause,
      select: {
        id: true,
        transactionType: true,
        fromEntityType: true,
        fromEntityId: true,
        toEntityType: true,
        toEntityId: true,
        quantity: true,
        deliveryNote: true,
        timestamp: true,
        notes: true,
        receivedBy: true,
        deliverySupervisor: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            imageUrl: true,
            isSerialized: true,
            brand: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 1000,
    }),
    prisma.inventoryTransaction.count({
      where: whereClause
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Load all active brands to pass down as filters
  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  });

  return (
    <ClientReturnsLedgerClient
      transactions={transactions}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      brands={brands}
    />
  );
}
