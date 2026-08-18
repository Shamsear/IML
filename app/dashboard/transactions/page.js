import { getTransactions } from '@/app/actions/transactions';
import { getProductsSlim } from '@/app/actions/products';
import TransactionsClient from './TransactionsClient';

export default async function TransactionsPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const search = params?.search || '';
  const type = params?.type || 'ALL';
  const productId = params?.productId || 'ALL';

  const [
    result,
    products
  ] = await Promise.all([
    getTransactions({ search, type, productId, page }),
    getProductsSlim()
  ]);

  const { transactions, totalCount } = result;
  const totalPages = Math.ceil(totalCount / 50);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      products={products}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      initialSearch={search}
      initialType={type}
      initialProductId={productId}
    />
  );
}
