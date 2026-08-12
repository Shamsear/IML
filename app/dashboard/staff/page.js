import { getStaff } from '@/app/actions/staff';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import StaffClient from './StaffClient';

export default async function StaffPage() {
  const [staff, stores, supervisors] = await Promise.all([
    getStaff(),
    getStores(),
    getSupervisors(),
  ]);

  return (
    <StaffClient 
      initialStaff={staff} 
      stores={stores} 
      supervisors={supervisors}
    />
  );
}
