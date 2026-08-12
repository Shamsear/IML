import { getProducts } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import { getRecentReceivers, getRecentSuppliers } from '@/app/actions/transactions';
import InboundClient from '../InboundClient';

export const metadata = {
  title: 'New Inbound Receipt - Inventory System',
  description: 'Log inbound supplier inventory receipts',
};

export default async function NewInboundPage() {
  const [
    products,
    stores,
    supervisors,
    staff,
    recentReceivers,
    recentSuppliers
  ] = await Promise.all([
    getProducts(),
    getStores(),
    getSupervisors(),
    getStaff(),
    getRecentReceivers(),
    getRecentSuppliers()
  ]);

  return (
    <InboundClient 
      products={products} 
      stores={stores}
      supervisors={supervisors}
      staff={staff}
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
    />
  );
}
