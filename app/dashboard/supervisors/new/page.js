import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import NewSupervisorClient from './NewSupervisorClient';

export const metadata = {
  title: 'Add Supervisor - IML Inventory',
  description: 'Register a new delivery supervisor',
};

export default async function NewSupervisorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return <NewSupervisorClient />;
}
