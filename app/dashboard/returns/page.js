import { getTransactions } from '@/app/actions/transactions';
import { getStores } from '@/app/actions/staff';
import ReturnsClient from './ReturnsClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Returns & Usage Hub',
};

export default async function ReturnsPage() {
  const transactions = await getTransactions();
  const stores = await getStores();
  
  // Filter only OUTBOUND transactions that are not fully RETURNED or USED
  const activeOutbounds = transactions.filter(t => 
    t.transactionType === 'OUTBOUND' && 
    t.returnStatus !== 'RETURNED' && 
    t.returnStatus !== 'USED' &&
    (t.quantity - (t.returnedQty || 0)) > 0
  );

  return (
    <Suspense fallback={<div>Loading Returns Hub...</div>}>
      <ReturnsClient 
        transactions={activeOutbounds} 
        stores={stores} 
      />
    </Suspense>
  );
}

