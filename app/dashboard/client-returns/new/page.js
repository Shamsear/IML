import { prisma } from '@/lib/prisma';
import ClientReturnsClient from '../ClientReturnsClient';

export const metadata = {
  title: 'Log Client Return - Inventory System',
  description: 'Log stock items returned back to client brand owners',
};

export default async function NewClientReturnPage() {
  const [brands, products, supervisors] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        brand: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.supervisor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
  ]);

  return (
    <ClientReturnsClient
      brands={brands}
      products={products}
      supervisors={supervisors}
    />
  );
}
