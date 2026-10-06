import NewBrandClient from './NewBrandClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Register Brand - Inventory System',
  description: 'Register one or more new brand owners in the inventory system',
};

export default async function NewBrandPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/brands');
  }

  return <NewBrandClient />;
}
