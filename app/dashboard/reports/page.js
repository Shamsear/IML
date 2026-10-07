import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';
import { getProductStock } from '@/lib/stock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // Fetch brands, products, ledger transactions, and serial aggregates concurrently
  const [brands, products, transactions, serialAggs] = await Promise.all([
    prisma.brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        itemCode: true,
        category: true,
        imageUrl: true,
        brandId: true,
        isSerialized: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' }
    }),
    prisma.inventoryTransaction.findMany({
      select: {
        productId: true,
        transactionType: true,
        quantity: true,
        fromEntityType: true,
        toEntityType: true,
        returnStatus: true,
        deliveryNote: true,
        notes: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' }
    }),
    prisma.productSerialNumber.groupBy({
      by: ['productId', 'status', 'currentLocationType'],
      _count: { id: true }
    })
  ]);

  // Group transactions by product in chronological sequence
  const txMap = new Map();
  transactions.forEach(t => {
    if (!txMap.has(t.productId)) {
      txMap.set(t.productId, []);
    }
    txMap.get(t.productId).push(t);
  });

  const serialsMap = new Map();
  serialAggs.forEach(item => {
    if (!serialsMap.has(item.productId)) {
      serialsMap.set(item.productId, {
        warehouse: 0,
        issued: 0,
        used: 0,
        withClient: 0,
        damage: 0,
        lost: 0
      });
    }
    const stats = serialsMap.get(item.productId);
    const count = item._count.id || 0;
    const status = item.status;
    const loc = item.currentLocationType;

    if (status === 'AVAILABLE') {
      if (loc === 'STORE') {
        stats.issued += count;
      } else {
        stats.warehouse += count;
      }
    } else if (status === 'WITH_CLIENT' || loc === 'CLIENT' || loc === 'BRAND') {
      stats.withClient += count;
    } else if (status === 'DAMAGED') {
      stats.damage += count;
    } else if (status === 'LOST') {
      stats.lost += count;
    } else if (status === 'USED' || loc === 'STAFF') {
      stats.used += count;
    }
  });

  const productsWithStock = products.map(product => {
    const productTxs = txMap.get(product.id) || [];
    const stock = getProductStock(productTxs);

    if (product.isSerialized && serialsMap.has(product.id)) {
      const stats = serialsMap.get(product.id);
      stock.warehouse = stats.warehouse;
      stock.withClient = stats.withClient;
      stock.damage = stats.damage;
      stock.lost = stats.lost;
      stock.issued = stats.issued;
      stock.used = stats.used;
      stock.total = stats.warehouse;
    }

    return {
      ...product,
      stock,
    };
  });

  return (
    <ReportsClient 
      initialProducts={productsWithStock} 
      brands={brands} 
    />
  );
}
