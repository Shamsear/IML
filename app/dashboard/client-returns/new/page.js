import { prisma } from '@/lib/prisma';
import { getProductsSlim } from '@/app/actions/products';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClientReturnsClient from '../ClientReturnsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Log Client Return - Inventory System',
  description: 'Log stock items returned back to client brand owners',
};

export default async function NewClientReturnPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/client-returns');
  }

  const [brands, products, stores] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    getProductsSlim(),
    prisma.store.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, location: true }
    })
  ]);

  return (
    <ClientReturnsClient
      brands={brands}
      products={products}
      stores={stores}
    />
  );
}
