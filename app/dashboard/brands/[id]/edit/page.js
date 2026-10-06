import { getBrandWithDetails } from '@/app/actions/brands';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import EditBrandClient from './EditBrandClient';

export const metadata = {
  title: 'Edit Brand - Inventory System',
  description: 'Modify brand guidelines, logo, and settings',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditBrandPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/brands');
  }

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
