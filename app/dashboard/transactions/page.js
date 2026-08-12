import { getTransactions } from '@/app/actions/transactions';
import { getProducts } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import TransactionsClient from './TransactionsClient';

export default async function TransactionsPage() {
  const [
    transactions,
    products,
    stores,
    supervisors,
    staff
  ] = await Promise.all([
    getTransactions(),
    getProducts(),
    getStores(),
    getSupervisors(),
    getStaff()
  ]);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      products={products}
      stores={stores}
      supervisors={supervisors}
      staff={staff}
    />
  );
}
