import { prisma } from '@/lib/prisma';
import { getProductsSlim } from '@/app/actions/products';
import ClientReturnsClient from '../ClientReturnsClient';

export const metadata = {
  title: 'Log Client Return - Inventory System',
  description: 'Log stock items returned back to client brand owners',
};

export default async function NewClientReturnPage() {
  const [brands, products] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    getProductsSlim()
  ]);

  return (
    <ClientReturnsClient
      brands={brands}
      products={products}
    />
  );
}
