import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // Fetch all brands for the filter dropdown
  const brands = await prisma.brand.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  // Fetch all products, their owners, and all ledger logs to calculate aggregated metrics
  const products = await prisma.product.findMany({
    include: {
      brand: { select: { id: true, name: true } },
      transactions: {
        select: {
          transactionType: true,
          quantity: true,
          fromEntityType: true,
          toEntityType: true,
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return (
    <ReportsClient 
      initialProducts={products} 
      brands={brands} 
    />
  );
}
