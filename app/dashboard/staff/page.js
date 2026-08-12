import { getStaff } from '@/app/actions/staff';
import { getStores } from '@/app/actions/stores';
import StaffClient from './StaffClient';

export default async function StaffPage() {
  const [staff, stores] = await Promise.all([
    getStaff(),
    getStores(),
  ]);

  return (
    <StaffClient 
      initialStaff={staff} 
      stores={stores} 
    />
  );
}
