import { prisma } from '@/lib/prisma';
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
    prisma.product.findMany({
      include: {
        brand: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
  ]);

  return (
    <ClientReturnsClient
      brands={brands}
      products={products}
    />
  );
}
