import { getBrandWithDetails } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import { getSupervisors } from '@/app/actions/supervisors';
import { getStaff } from '@/app/actions/staff';
import BrandDetailClient from './BrandDetailClient';

export default async function BrandDetailPage({ params }) {
  const { id } = await params;

  const [
    brand,
    stores,
    supervisors,
    staff
  ] = await Promise.all([
    getBrandWithDetails(id),
    getStores(),
    getSupervisors(),
    getStaff()
  ]);

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h2 className="font-display font-bold text-lg text-text-primary">Brand not found</h2>
        <p className="text-sm text-text-secondary">The brand you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  return (
    <BrandDetailClient
      brand={brand}
      allStores={stores}
      supervisors={supervisors}
      staff={staff}
    />
  );
}
