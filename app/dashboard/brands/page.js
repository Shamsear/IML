import { getBrands } from '@/app/actions/brands';
import BrandsClient from './BrandsClient';

export default async function BrandsPage() {
  const brands = await getBrands();
  return <BrandsClient initialBrands={brands} />;
}
