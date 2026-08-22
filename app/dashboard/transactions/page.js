import { Suspense } from 'react';
import { getTransactions } from '@/app/actions/transactions';
import { getProductsSlim } from '@/app/actions/products';
import { prisma } from '@/lib/prisma';
import TransactionsClient from './TransactionsClient';

export default async function TransactionsPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const search = params?.search || '';
  const type = params?.type || 'ALL';
  const productId = params?.productId || 'ALL';

  const [
    result,
    products,
    stores,
    supervisors,
    staff
  ] = await Promise.all([
    getTransactions({ search, type, productId, page }),
    getProductsSlim(),
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);

  const { transactions, totalCount } = result;
  const totalPages = Math.ceil(totalCount / 50);

  const entityNames = {};
  stores.forEach(s => { entityNames[s.id] = s.name; });
  supervisors.forEach(s => { entityNames[s.id] = s.name; });
  staff.forEach(s => { entityNames[s.id] = s.name; });

  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <TransactionsClient
        initialTransactions={transactions}
        products={products}
        totalCount={totalCount}
        totalPages={totalPages}
        page={page}
        initialSearch={search}
        initialType={type}
        initialProductId={productId}
        entityNames={entityNames}
      />
    </Suspense>
  );
}
