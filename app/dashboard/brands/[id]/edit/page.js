import { getBrandWithDetails } from '@/app/actions/brands';
import { notFound } from 'next/navigation';
import EditBrandClient from './EditBrandClient';

export const metadata = {
  title: 'Edit Brand - Inventory System',
  description: 'Modify brand guidelines, logo, and settings',
};

export default async function EditBrandPage({ params }) {
  const { id } = await params;
  const brand = await getBrandWithDetails(id);
  if (!brand) {
    notFound();
  }

  // Sanitize the brand object for client consumption
  const sanitizedBrand = {
    id: brand.id,
    name: brand.name,
    description: brand.description || '',
    imageUrl: brand.imageUrl || '',
    rack: brand.rack || '',
    shelf: brand.shelf || '',
    isPublic: brand.isPublic,
  };

  return <EditBrandClient brand={sanitizedBrand} />;
}
