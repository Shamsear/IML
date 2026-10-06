import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import EditStoreClient from './EditStoreClient';

export const metadata = {
  title: 'Edit Store - IML Inventory',
  description: 'Modify store details and settings',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditStorePage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/stores');
  }

  const { id } = await params;
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) notFound();

  return <EditStoreClient store={store} />;
}
