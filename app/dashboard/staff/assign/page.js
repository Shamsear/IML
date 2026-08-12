import { getStaff, getAllocationDetails } from '@/app/actions/staff';
import { getStores } from '@/app/actions/stores';
import AssignClient from './AssignClient';

export default async function AssignPage({ searchParams }) {
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
