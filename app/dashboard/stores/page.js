import { getStores } from '@/app/actions/stores';
import StoresClient from './StoresClient';

export default async function StoresPage() {
  const stores = await getStores();
  return <StoresClient initialStores={stores} />;
}
