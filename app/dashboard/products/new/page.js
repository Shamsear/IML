import { prisma } from '@/lib/prisma';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import { getRecentReceivers, getRecentSuppliers } from '@/app/actions/transactions';
import NewProductClient from './NewProductClient';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const isEdit = !!params.editId;
  return {
    title: isEdit ? 'Edit Product - Inventory System' : 'Register New Product - Inventory System',
    description: isEdit ? 'Edit existing product in the catalog' : 'Add a new product to the catalog with initial stock',
  };
}

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
