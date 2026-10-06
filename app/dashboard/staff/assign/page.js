import { getStaff, getAllocationDetails } from '@/app/actions/staff';
import { getStores } from '@/app/actions/stores';
import AssignClient from './AssignClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function AssignPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/staff');
  }

  const params = await searchParams;
  const allocationId = params?.id || null;
  const editStaffId = params?.editStaffId || null;

  const [staff, stores, allocation] = await Promise.all([
    getStaff(),
    getStores(),
    allocationId ? getAllocationDetails(allocationId) : null,
  ]);

  const editStaffObj = editStaffId ? staff.find(s => s.id === editStaffId) : null;

  return (
    <AssignClient
      staffList={staff}
      stores={stores}
      initialAllocation={allocation}
      editStaffObj={editStaffObj}
    />
  );
}
