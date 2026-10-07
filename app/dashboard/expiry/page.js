import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import ExpiryClient from './ExpiryClient';

export const metadata = {
  title: 'Expiry Tracking - Inventory System',
  description: 'Track manufacture and expiry dates of inventory batches',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExpiryPage() {
  // Fetch all RECEIVE transactions for products that track expiry in parallel with stock aggregates
  const [transactions, stockAggs] = await Promise.all([
    prisma.inventoryTransaction.findMany({
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
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType'],
      _sum: { quantity: true },
    }),
  ]);

  // Pre-compute warehouse stock per product from aggregates
  const warehouseStockMap = new Map();
  stockAggs.forEach(agg => {
    const pid = agg.productId;
    const qty = agg._sum?.quantity || 0;
    let current = warehouseStockMap.get(pid) || 0;
    if (agg.toEntityType === 'WAREHOUSE' && ['RECEIVE', 'RETURN', 'REBRAND_IN', 'CLIENT_RETURN'].includes(agg.transactionType)) {
      current += qty;
    } else if (agg.fromEntityType === 'WAREHOUSE' && ['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT', 'CLIENT_STOCK'].includes(agg.transactionType)) {
      current -= qty;
    }
    warehouseStockMap.set(pid, current);
  });

  // Clamp any negative balances to 0 after all movements have been netted
  for (const [pid, val] of warehouseStockMap.entries()) {
    warehouseStockMap.set(pid, Math.max(0, val));
  }

  // Map transactions to batch objects — group by product, keep earliest expiry
  const productBatchMap = new Map();
  
  transactions.forEach((tx) => {
    const productId = tx.productId;
    const warehouseStock = warehouseStockMap.get(productId) || 0;
    
    // Only process if product has stock in warehouse
    if (warehouseStock > 0) {
      if (!productBatchMap.has(productId) || 
          (tx.expiryDate && productBatchMap.get(productId).expiryDate && 
           new Date(tx.expiryDate) < new Date(productBatchMap.get(productId).expiryDate))) {
        productBatchMap.set(productId, {
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
          remainingBatchStock: warehouseStock,
          receivedDate: tx.timestamp,
          manufactureDate: tx.manufactureDate,
          expiryDate: tx.expiryDate,
          availableSerials: [],
        });
      }
    }
  });

  const activeBatches = Array.from(productBatchMap.values())
    .sort((a, b) => {
      // Sort by expiry date (earliest first)
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

  return <ExpiryClient initialBatches={activeBatches} />;
}

