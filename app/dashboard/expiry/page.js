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

  // For each batch (RECEIVE transaction), calculate how much has been outbounded FROM that specific batch
  // We'll use deliveryNote + productId to track batch-level movements
  const batches = await Promise.all(
    transactions.map(async (tx) => {
      // Calculate total outbound from this specific batch (matching deliveryNote and product)
      const outboundFromBatch = await prisma.inventoryTransaction.aggregate({
        where: {
          deliveryNote: tx.deliveryNote,
          productId: tx.productId,
          fromEntityType: 'WAREHOUSE',
          transactionType: { in: ['ISSUE', 'OUTBOUND'] },
        },
        _sum: {
          quantity: true,
        },
      });

      // Calculate returns back to warehouse for this batch
      const returnsToWarehouse = await prisma.inventoryTransaction.aggregate({
        where: {
          deliveryNote: tx.deliveryNote,
          productId: tx.productId,
          toEntityType: 'WAREHOUSE',
          transactionType: 'RETURN',
        },
        _sum: {
          quantity: true,
        },
      });

      const receivedQty = tx.quantity;
      const outboundQty = outboundFromBatch._sum.quantity || 0;
      const returnedQty = returnsToWarehouse._sum.quantity || 0;
      // Current warehouse stock = received - outbound + returned
      const remainingBatchStock = receivedQty - outboundQty + returnedQty;

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
        receivedQty: receivedQty,
        outboundedQty: outboundQty,
        returnedQty: returnedQty,
        remainingBatchStock: remainingBatchStock,
        receivedDate: tx.timestamp,
        manufactureDate: tx.manufactureDate,
        expiryDate: tx.expiryDate,
        availableSerials: [],
      };
    })
  );

  // Filter out batches with no stock currently in warehouse (remaining stock <= 0)
  // This shows only items currently in the warehouse
  const activeBatches = batches.filter((batch) => batch.remainingBatchStock > 0);

  return <ExpiryClient initialBatches={activeBatches} />;
}

