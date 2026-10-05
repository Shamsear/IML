import { getClientReturnsBalances } from '@/app/actions/transactions';
import { prisma } from '@/lib/prisma';
import ClientReturnsBalancesClient from '../ClientReturnsBalancesClient';

export const metadata = {
  title: 'Stock Balances with Clients - Inventory System',
  description: 'Review quantity summaries and serial lists of stock held by clients',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientReturnsBalancesPage() {
  const [balances, recentTransactions] = await Promise.all([
    getClientReturnsBalances(),
    // Fetch last 100 client transactions (both directions)
    prisma.inventoryTransaction.findMany({
      where: {
        OR: [
          { transactionType: { in: ['CLIENT_STOCK', 'CLIENT_RETURN'] } },
          { toEntityType: { in: ['CLIENT', 'BRAND'] } },
          { fromEntityType: { in: ['CLIENT', 'BRAND'] } }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
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
      }
    }),
  ]);

  return (
    <ClientReturnsBalancesClient
      balances={JSON.parse(JSON.stringify(balances))}
      recentTransactions={JSON.parse(JSON.stringify(recentTransactions))}
    />
  );
}
