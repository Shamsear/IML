import { getStores } from '@/app/actions/stores';
import StoresClient from './StoresClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StoresPage() {
  const stores = await getStores();
  return <StoresClient initialStores={stores} />;
}
