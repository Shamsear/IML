import { getClientReturnsBalances } from '@/app/actions/transactions';
import { prisma } from '@/lib/prisma';
import ClientReturnsBalancesClient from '../ClientReturnsBalancesClient';

export const metadata = {
  title: 'Stock Balances with Clients - Inventory System',
  description: 'Review quantity summaries and serial lists of stock held by clients',
};

export default async function ClientReturnsBalancesPage() {
  const [balances, recentTransactions] = await Promise.all([
    getClientReturnsBalances(),
    // Fetch last 100 CLIENT_RETURN transactions (both directions)
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'CLIENT_RETURN',
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
      balances={balances}
      recentTransactions={recentTransactions}
    />
  );
}
