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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Brand not found</h2>
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
