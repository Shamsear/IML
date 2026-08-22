import { Suspense } from 'react';
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
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <StaffClient 
        initialStaff={staff} 
        stores={stores} 
        supervisors={supervisors}
      />
    </Suspense>
  );
}
