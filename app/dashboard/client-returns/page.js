import { prisma } from '@/lib/prisma';
import ClientReturnsLedgerClient from './ClientReturnsLedgerClient';

export const metadata = {
  title: 'Client Returns Ledger - Inventory System',
  description: 'Review stock items returned to client brand owners',
};

export default async function ClientReturnsPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  // Query all CLIENT_RETURN transactions with skip and take
  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'CLIENT_RETURN',
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({
      where: {
        transactionType: 'CLIENT_RETURN',
      }
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
