import { Suspense } from 'react';
import { getBrands } from '@/app/actions/brands';
import BrandsClient from './BrandsClient';

export default async function BrandsPage() {
  const brands = await getBrands();
  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <BrandsClient initialBrands={brands} />
    </Suspense>
  );
}
