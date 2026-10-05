import { getBrandWithDetails } from '@/app/actions/brands';
import { notFound } from 'next/navigation';
import BrandHeadingsClient from './BrandHeadingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BrandHeadingsPage({ params }) {
  const { id } = await params;
  const brand = await getBrandWithDetails(id);

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h2 className="font-display font-bold text-lg text-text-primary">Brand not found</h2>
        <p className="text-sm text-text-secondary">The brand you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  return <BrandHeadingsClient brand={brand} />;
}
