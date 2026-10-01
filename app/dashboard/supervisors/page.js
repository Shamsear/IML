import { getSupervisors } from '@/app/actions/supervisors';
import SupervisorsClient from './SupervisorsClient';

export default async function SupervisorsPage() {
  const supervisors = await getSupervisors();
  return <SupervisorsClient initialSupervisors={supervisors} />;
}
