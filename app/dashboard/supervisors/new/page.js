import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import NewSupervisorClient from './NewSupervisorClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Add Supervisor - IML Inventory',
  description: 'Register a new delivery supervisor',
};

export default async function NewSupervisorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/supervisors');
  }

  return <NewSupervisorClient />;
}
