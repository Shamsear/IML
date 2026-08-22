import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import NewStoreClient from './NewStoreClient';

export const metadata = {
  title: 'Add Store - IML Inventory',
  description: 'Register a new retail outlet in the inventory system',
};

export default async function NewStorePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return <NewStoreClient />;
}
