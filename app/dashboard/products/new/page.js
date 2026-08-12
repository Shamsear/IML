import { prisma } from '@/lib/prisma';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import { getRecentReceivers, getRecentSuppliers } from '@/app/actions/transactions';
import NewProductClient from './NewProductClient';

export const metadata = {
  title: 'Register New Product - Inventory System',
  description: 'Add a new product to the catalog with initial stock',
};

export default async function NewProductPage() {
  const [
    brands,
    stores,
    supervisors,
    staff,
    recentReceivers,
    recentSuppliers
  ] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    getStores(),
    getSupervisors(),
    getStaff(),
    getRecentReceivers(),
    getRecentSuppliers()
  ]);

  return (
    <NewProductClient 
      brands={brands} 
      stores={stores}
      supervisors={supervisors}
      staff={staff}
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
    />
  );
}
