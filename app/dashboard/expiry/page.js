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
          warehouseStock: true, // Get current warehouse stock from Product
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

  // Map transactions to batch objects
  // Group by product and show only products with warehouse stock > 0
  const productBatchMap = new Map();
  
  transactions.forEach((tx) => {
    const productId = tx.productId;
    const warehouseStock = tx.product.warehouseStock || 0;
    
    // Only process if product has stock in warehouse
    if (warehouseStock > 0) {
      // Keep track of earliest expiry batch per product
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
          remainingBatchStock: warehouseStock, // Current warehouse stock from Product table
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

