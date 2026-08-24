import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import UnsavedChangesGuard from '@/components/UnsavedChangesGuard';

export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardShell user={session.user}>
      {children}
      <UnsavedChangesGuard />
    </DashboardShell>
  );
}
