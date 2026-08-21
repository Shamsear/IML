import { getClientReturnsBalances } from '@/app/actions/transactions';
import ClientReturnsBalancesClient from '../ClientReturnsBalancesClient';

export const metadata = {
  title: 'Stock Balances with Clients - Inventory System',
  description: 'Review quantity summaries and serial lists of stock held by clients',
};

export default async function ClientReturnsBalancesPage() {
  const balances = await getClientReturnsBalances();

  return (
    <ClientReturnsBalancesClient
      balances={balances}
    />
  );
}
