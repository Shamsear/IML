import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import NewStoreClient from './NewStoreClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Add Store - IML Inventory',
  description: 'Register a new retail outlet in the inventory system',
};

export default async function NewStorePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/stores');
  }

  return <NewStoreClient />;
}
