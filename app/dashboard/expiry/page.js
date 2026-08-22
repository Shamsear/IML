import { Suspense } from 'react';
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
          transactions: {
            select: {
              transactionType: true,
              quantity: true,
              fromEntityType: true,
              toEntityType: true,
            }
          }
        },
      },
    },
    orderBy: {
      expiryDate: 'asc',
    },
  });

  // Pre-compute correct warehouse stock per product using the same logic
  // as computeWarehouseStockMap (handles RECEIVE/RETURN/ISSUE/DAMAGE/LOST/etc.)
  const warehouseStockMap = new Map();
  transactions.forEach((tx) => {
    const pid = tx.productId;
    if (!warehouseStockMap.has(pid)) {
      // Collect all transactions for this product from the nested relation
      const allTxs = tx.product?.transactions || [];
      let stock = 0;
      allTxs.forEach(t => {
        const qty = t.quantity || 0;
        if (t.toEntityType === 'WAREHOUSE' && ['RECEIVE', 'RETURN', 'REBRAND_IN'].includes(t.transactionType)) {
          stock += qty;
        } else if (t.fromEntityType === 'WAREHOUSE' && ['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT'].includes(t.transactionType)) {
          stock -= qty;
        }
      });
      warehouseStockMap.set(pid, Math.max(0, stock));
    }
  });

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

  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warning animate-[pulse_1.4s_ease-in-out_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-warning animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" /><span className="w-1.5 h-1.5 rounded-full bg-warning animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" /></div></div>}>
      <ExpiryClient initialBatches={activeBatches} />
    </Suspense>
  );
}

