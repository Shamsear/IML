import { getSupervisors } from '@/app/actions/supervisors';
import SupervisorsClient from './SupervisorsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SupervisorsPage() {
  const supervisors = await getSupervisors();
  return <SupervisorsClient initialSupervisors={supervisors} />;
}
