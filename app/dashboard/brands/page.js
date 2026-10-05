import { getBrands } from '@/app/actions/brands';
import BrandsClient from './BrandsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BrandsPage() {
  const brands = await getBrands();
  return <BrandsClient initialBrands={brands} />;
}
