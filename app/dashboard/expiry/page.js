import { prisma } from '@/lib/prisma';
import ExpiryClient from './ExpiryClient';

export const metadata = {
  title: 'Expiry Tracking - Inventory System',
  description: 'Track manufacture and expiry dates of inventory batches',
};

export default async function ExpiryPage() {
  // Fetch all RECEIVE transactions for products that track expiry
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      transactionType: 'RECEIVE',
      product: {
        trackExpiry: true,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          category: true,
          isSerialized: true,
          brand: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      expiryDate: 'asc',
    },
  });

  // Calculate current stock levels of these products to help the user know if the batch is still in stock
  const productIds = Array.from(new Set(transactions.map((tx) => tx.productId)));

  const [inboundAgg, outboundAgg] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        toEntityType: 'WAREHOUSE',
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        fromEntityType: 'WAREHOUSE',
      },
      _sum: {
        quantity: true,
      },
    }),
  ]);

  const stockMap = {};
  productIds.forEach((id) => {
    const inQty = inboundAgg.find((a) => a.productId === id)?._sum.quantity || 0;
    const outQty = outboundAgg.find((a) => a.productId === id)?._sum.quantity || 0;
    stockMap[id] = inQty - outQty;
  });

  // Map transactions to batch objects
  const batches = transactions.map((tx) => {
    return {
      id: tx.id,
      productId: tx.productId,
      productName: tx.product.name,
      productCategory: tx.product.category,
      productBrand: tx.product.brand?.name || 'No Brand',
      productImage: tx.product.imageUrl,
      isSerialized: tx.product.isSerialized,
      deliveryNote: tx.deliveryNote || 'N/A',
      supplier: tx.fromEntityId || 'Unknown Supplier',
      receivedQty: tx.quantity,
      currentProductStock: stockMap[tx.productId] || 0,
      receivedDate: tx.timestamp,
      manufactureDate: tx.manufactureDate,
      expiryDate: tx.expiryDate,
      availableSerials: [],
    };
  });

  return <ExpiryClient initialBatches={batches} />;
}
