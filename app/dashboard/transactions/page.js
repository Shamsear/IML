import { getTransactions } from '@/app/actions/transactions';
import { getProductsSlim } from '@/app/actions/products';
import TransactionsClient from './TransactionsClient';

export default async function TransactionsPage() {
  const [
    transactions,
    products
  ] = await Promise.all([
    getTransactions(),
    getProductsSlim()
  ]);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      products={products}
    />
  );
}
