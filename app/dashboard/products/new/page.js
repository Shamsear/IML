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

export default async function NewProductPage({ searchParams }) {
  const params = await searchParams;
  const editId = params?.editId || null;

  const [
    brands,
    stores,
    supervisors,
    staff,
    recentReceivers,
    recentSuppliers,
    categoriesData
  ] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    getStores(),
    getSupervisors(),
    getStaff(),
    getRecentReceivers(),
    getRecentSuppliers(),
    prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } }
    })
  ]);

  const categories = categoriesData.map(c => c.category).filter(Boolean);

  return (
    <NewProductClient 
      brands={brands} 
      stores={stores}
      supervisors={supervisors}
      staff={staff}
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
      editId={editId}
      existingCategories={categories}
    />
  );
}
