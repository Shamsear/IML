import { getProducts } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import OutboundClient from '../OutboundClient';

export const metadata = {
  title: 'New Outbound Dispatch - Inventory System',
  description: 'Log outbound inventory dispatches and transfers',
};

export default async function NewOutboundPage() {
  const [
    products,
    stores,
    supervisors,
    staff
  ] = await Promise.all([
    getProducts(),
    getStores(),
    getSupervisors(),
    getStaff()
  ]);

  return (
    <OutboundClient
      products={products}
      stores={stores}
      supervisors={supervisors}
      staff={staff}
    />
  );
}
