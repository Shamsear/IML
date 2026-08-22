import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import EditSupervisorClient from './EditSupervisorClient';

export const metadata = {
  title: 'Edit Supervisor - IML Inventory',
  description: 'Modify supervisor details',
};

export default async function EditSupervisorPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { id } = await params;
  const supervisor = await prisma.supervisor.findUnique({ where: { id } });
  if (!supervisor) notFound();

  return <EditSupervisorClient supervisor={supervisor} />;
}
