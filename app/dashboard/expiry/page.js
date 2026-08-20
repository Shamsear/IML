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
          itemCode: true,
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

  // For each batch (RECEIVE transaction), calculate remaining stock in warehouse
  const batches = await Promise.all(
    transactions.map(async (tx) => {
      // For batch-level tracking, we need to track by the specific RECEIVE transaction
      // But outbound transactions don't necessarily reference the original receive DN
      // So we calculate at product level for the warehouse
      
      // Get total warehouse stock for this product (all batches combined)
      const [inboundTotal, outboundTotal] = await Promise.all([
        prisma.inventoryTransaction.aggregate({
          where: {
            productId: tx.productId,
            toEntityType: 'WAREHOUSE',
            transactionType: { in: ['RECEIVE', 'RETURN'] },
          },
          _sum: { quantity: true },
        }),
        prisma.inventoryTransaction.aggregate({
          where: {
            productId: tx.productId,
            fromEntityType: 'WAREHOUSE',
            transactionType: { in: ['ISSUE', 'OUTBOUND'] },
          },
          _sum: { quantity: true },
        }),
      ]);

      const totalWarehouseStock = (inboundTotal._sum.quantity || 0) - (outboundTotal._sum.quantity || 0);

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
        remainingBatchStock: totalWarehouseStock, // Show total product warehouse stock
        receivedDate: tx.timestamp,
        manufactureDate: tx.manufactureDate,
        expiryDate: tx.expiryDate,
        availableSerials: [],
      };
    })
  );

  // Filter: only show batches where the product still has stock in warehouse
  // AND remove duplicate products (keep earliest expiry date per product)
  const productMap = new Map();
  batches
    .filter(batch => batch.remainingBatchStock > 0)
    .sort((a, b) => {
      // Sort by expiry date (earliest first)
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    })
    .forEach(batch => {
      // Keep only the earliest expiry batch per product
      if (!productMap.has(batch.productId)) {
        productMap.set(batch.productId, batch);
      }
    });

  const activeBatches = Array.from(productMap.values());

  return <ExpiryClient initialBatches={activeBatches} />;
}

