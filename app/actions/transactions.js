'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
  return session;
}

// 1. Calculate stock at a specific location for bulk products
export async function getStockAtLocation(productId, entityType, entityId) {
  await checkAuth();

  // Inbound stock
  const inbound = await prisma.inventoryTransaction.aggregate({
    where: {
      productId,
      toEntityType: entityType,
      toEntityId: entityId || null,
    },
    _sum: { quantity: true },
  });

  // Outbound stock
  const outbound = await prisma.inventoryTransaction.aggregate({
    where: {
      productId,
      fromEntityType: entityType,
      fromEntityId: entityId || null,
    },
    _sum: { quantity: true },
  });

  const inQty = inbound._sum.quantity || 0;
  const outQty = outbound._sum.quantity || 0;

  return inQty - outQty;
}

// 2. Fetch all transactions
export async function getTransactions() {
  await checkAuth();
  return prisma.inventoryTransaction.findMany({
    orderBy: { timestamp: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isSerialized: true,
          brand: { select: { name: true } },
        }
      }
    }
  });
}

// 3. Create a transaction (Receive, Issue, Return, Damage)
export async function createTransaction(data) {
  await checkAuth();

  const {
    productId,
    transactionType,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    quantity,
    deliveryNote,
    deliveryStatus,
    notes,
    receivedBy,
    barcodes = [], // Used for serialized products
  } = data;

  if (!productId) throw new Error('Product ID is required');
  if (!transactionType) throw new Error('Transaction Type is required');
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw new Error('Product not found');

  // Verify stock levels for outbound transactions of bulk products
  if (!product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
    const currentStock = await getStockAtLocation(productId, fromEntityType, fromEntityId);
    if (currentStock < quantity) {
      throw new Error(`Insufficient stock. Current stock at ${fromEntityType} is ${currentStock}, requested ${quantity}.`);
    }
  }

  // Handle transaction inside a secure Prisma Transaction block
  const transaction = await prisma.$transaction(async (tx) => {
    // A. Create the core ledger transaction
    const invTx = await tx.inventoryTransaction.create({
      data: {
        productId,
        transactionType,
        fromEntityType,
        fromEntityId: fromEntityId || null,
        toEntityType,
        toEntityId: toEntityId || null,
        quantity,
        deliveryNote,
        deliveryStatus,
        notes,
        receivedBy,
      },
    });

    // B. Handle Serialized Barcode Updates
    if (product.isSerialized && barcodes.length > 0) {
      // Find serials by their barcode strings
      const dbSerials = await tx.productSerialNumber.findMany({
        where: {
          productId,
          barcode: { in: barcodes },
        },
      });

      if (dbSerials.length !== barcodes.length) {
        throw new Error('Some barcodes could not be found in the database catalog.');
      }

      // Check serial states for outbound transactions
      if (fromEntityType) {
        const invalidSerials = dbSerials.filter(
          (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
        );
        if (invalidSerials.length > 0) {
          throw new Error(`Some selected barcodes are not present at the source location (${fromEntityType}).`);
        }
      }

      // Update location and status on the serial number rows
      for (const serial of dbSerials) {
        let nextStatus = 'AVAILABLE';
        if (transactionType === 'DAMAGE') nextStatus = 'DAMAGED';
        else if (transactionType === 'LOST') nextStatus = 'LOST';
        else if (toEntityType === 'CLIENT' || toEntityType === 'STAFF') nextStatus = 'USED'; // Staff holding it or client used it

        await tx.productSerialNumber.update({
          where: { id: serial.id },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus,
          },
        });

        // Link the serial to this transaction log
        await tx.transactionSerialNumber.create({
          data: {
            transactionId: invTx.id,
            serialNumberId: serial.id,
          },
        });
      }
    }

    return invTx;
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transaction;
}

// 4. Rebrand items (Subtract A, Add B, Link Serials)
export async function processRebrand(data) {
  await checkAuth();

  const {
    oldProductId,
    newProductId,
    quantity,
    notes,
    barcodes = [], // Array of objects: { oldBarcode: string, newBarcode: string, newSecondary: string }
  } = data;

  if (!oldProductId || !newProductId) throw new Error('Both old and new products are required');
  if (!quantity || quantity <= 0) throw new Error('Rebrand quantity must be greater than 0');

  const [oldProduct, newProduct] = await Promise.all([
    prisma.product.findUnique({ where: { id: oldProductId } }),
    prisma.product.findUnique({ where: { id: newProductId } }),
  ]);

  if (!oldProduct || !newProduct) throw new Error('Products not found');

  await prisma.$transaction(async (tx) => {
    // 1. Log subtraction of old product (from Warehouse)
    await tx.inventoryTransaction.create({
      data: {
        productId: oldProductId,
        transactionType: 'REBRAND_OUT',
        fromEntityType: 'WAREHOUSE',
        quantity,
        notes: `Rebrand output -> ${newProduct.name}. ${notes || ''}`,
      },
    });

    // 2. Log addition of new product (to Warehouse)
    await tx.inventoryTransaction.create({
      data: {
        productId: newProductId,
        transactionType: 'REBRAND_IN',
        toEntityType: 'WAREHOUSE',
        quantity,
        notes: `Rebrand input <- ${oldProduct.name}. ${notes || ''}`,
      },
    });

    // 3. Update serials if serialized
    if (oldProduct.isSerialized && barcodes.length > 0) {
      for (const item of barcodes) {
        const oldSerial = await tx.productSerialNumber.findUnique({
          where: { barcode: item.oldBarcode },
        });

        if (!oldSerial) throw new Error(`Old barcode ${item.oldBarcode} not found.`);

        // Mark old serial as REPLACED and remove from active location
        await tx.productSerialNumber.update({
          where: { id: oldSerial.id },
          data: {
            status: 'REPLACED',
            currentLocationType: null,
            currentLocationId: null,
          },
        });

        // Create new serial record linking back to old serial (replacesId)
        await tx.productSerialNumber.create({
          data: {
            productId: newProductId,
            barcode: item.newBarcode.trim(),
            secondaryBarcode: item.newSecondary ? item.newSecondary.trim() : null,
            currentLocationType: 'WAREHOUSE',
            status: 'AVAILABLE',
            replacesId: oldSerial.id, // Traceability link!
          },
        });
      }
    }
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
}

// 5. Query active stock of a store
export async function getStoreInventory(storeId) {
  await checkAuth();

  const products = await prisma.product.findMany({
    include: {
      brand: { select: { name: true } }
    }
  });

  const inventory = [];

  for (const product of products) {
    let quantity = 0;
    let serials = [];

    if (product.isSerialized) {
      serials = await prisma.productSerialNumber.findMany({
        where: {
          productId: product.id,
          currentLocationType: 'STORE',
          currentLocationId: storeId,
          status: 'AVAILABLE',
        },
        select: { barcode: true, secondaryBarcode: true, status: true },
      });
      quantity = serials.length;
    } else {
      quantity = await getStockAtLocation(product.id, 'STORE', storeId);
    }

    if (quantity > 0) {
      inventory.push({
        productId: product.id,
        name: product.name,
        brandName: product.brand.name,
        isSerialized: product.isSerialized,
        quantity,
        serials,
      });
    }
  }

  return inventory;
}

// 6. Create multiple issue transactions atomically in a single batch
export async function createBulkIssueTransactions(payload) {
  await checkAuth();

  const {
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  if (items.length === 0) throw new Error('At least one product item is required for bulk issue');

  // Auto-generate Delivery Note number for the entire dispatch batch
  const autoDeliveryNote = `DN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes } = item;

      if (!productId) throw new Error('Product ID is required for all items');
      if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');

      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      // Verify stock levels for bulk (non-serialized) products
      if (!product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
        const inboundSum = await tx.inventoryTransaction.aggregate({
          where: {
            productId,
            toEntityType: fromEntityType,
            toEntityId: fromEntityId || null,
          },
          _sum: { quantity: true },
        });

        const outboundSum = await tx.inventoryTransaction.aggregate({
          where: {
            productId,
            fromEntityType: fromEntityType,
            fromEntityId: fromEntityId || null,
          },
          _sum: { quantity: true },
        });

        const inQty = inboundSum._sum.quantity || 0;
        const outQty = outboundSum._sum.quantity || 0;
        const currentStock = inQty - outQty;

        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Current stock at ${fromEntityType} is ${currentStock}, requested ${quantity}.`);
        }
      }

      // A. Create core transaction
      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'ISSUE',
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType,
          toEntityId: toEntityId || null,
          quantity,
          deliveryNote: autoDeliveryNote,
          notes: notes || `Bulk issue dispatch`,
          deliveryStatus: 'Delivered',
        },
      });

      // B. Link serialized serials
      if (product.isSerialized && barcodes.length > 0) {
        const dbSerials = await tx.productSerialNumber.findMany({
          where: {
            productId,
            barcode: { in: barcodes },
          },
        });

        if (dbSerials.length !== barcodes.length) {
          throw new Error(`Some barcodes for product "${product.name}" could not be found in the database.`);
        }

        if (fromEntityType) {
          const invalidSerials = dbSerials.filter(
            (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
          );
          if (invalidSerials.length > 0) {
            throw new Error(`Some barcodes for "${product.name}" are not present at the source location (${fromEntityType}).`);
          }
        }

        for (const serial of dbSerials) {
          let nextStatus = 'AVAILABLE';
          if (toEntityType === 'CLIENT' || toEntityType === 'STAFF') nextStatus = 'USED';

          await tx.productSerialNumber.update({
            where: { id: serial.id },
            data: {
              currentLocationType: toEntityType || null,
              currentLocationId: toEntityId || null,
              status: nextStatus,
            },
          });

          await tx.transactionSerialNumber.create({
            data: {
              transactionId: invTx.id,
              serialNumberId: serial.id,
            },
          });
        }
      }

      createdTxs.push(invTx);
    }

    return createdTxs;
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transactions;
}

// 7. Create multiple receive transactions atomically in a single batch
export async function createBulkReceiveTransactions(payload) {
  await checkAuth();

  const {
    fromEntityType = 'SUPPLIER',
    fromEntityId = 'Main Supplier',
    toEntityType = 'WAREHOUSE',
    toEntityId = null,
    receivedBy = null,
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  if (items.length === 0) throw new Error('At least one product item is required for bulk receive');

  // Auto-generate Delivery Note number for the entire receive batch
  const autoDeliveryNote = `DN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes } = item;

      if (!productId) throw new Error('Product ID is required for all items');
      if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');

      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      // A. Create core transaction
      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'RECEIVE',
          fromEntityType,
          fromEntityId,
          toEntityType,
          toEntityId,
          quantity,
          deliveryNote: autoDeliveryNote,
          notes: notes || `Bulk receive from ${fromEntityType}`,
          deliveryStatus: 'Delivered',
          receivedBy,
        },
      });

      // B. Create serials if serialized
      if (product.isSerialized && barcodes.length > 0) {
        const existingSerials = await tx.productSerialNumber.findMany({
          where: {
            productId,
            barcode: { in: barcodes },
          },
        });

        if (existingSerials.length > 0) {
          const dupes = existingSerials.map(s => s.barcode).join(', ');
          throw new Error(`Some barcodes already exist in the database for product "${product.name}": ${dupes}`);
        }

        for (const barcode of barcodes) {
          const serial = await tx.productSerialNumber.create({
            data: {
              productId,
              barcode: barcode.trim(),
              currentLocationType: toEntityType || 'WAREHOUSE',
              currentLocationId: toEntityId || null,
              status: 'AVAILABLE',
            },
          });

          await tx.transactionSerialNumber.create({
            data: {
              transactionId: invTx.id,
              serialNumberId: serial.id,
            },
          });
        }
      }

      createdTxs.push(invTx);
    }

    return createdTxs;
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transactions;
}

// 8. Log multiple damage transactions atomically in a single batch
export async function createBulkDamageTransactions(payload) {
  await checkAuth();

  const {
    fromEntityType,
    fromEntityId,
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  if (items.length === 0) throw new Error('At least one product item is required for damage logging');

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes } = item;

      if (!productId) throw new Error('Product ID is required for all items');
      if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');

      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      // Verify stock levels for bulk (non-serialized) products
      if (!product.isSerialized && fromEntityType) {
        const inboundSum = await tx.inventoryTransaction.aggregate({
          where: {
            productId,
            toEntityType: fromEntityType,
            toEntityId: fromEntityId || null,
          },
          _sum: { quantity: true },
        });

        const outboundSum = await tx.inventoryTransaction.aggregate({
          where: {
            productId,
            fromEntityType: fromEntityType,
            fromEntityId: fromEntityId || null,
          },
          _sum: { quantity: true },
        });

        const inQty = inboundSum._sum.quantity || 0;
        const outQty = outboundSum._sum.quantity || 0;
        const currentStock = inQty - outQty;

        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Current stock at ${fromEntityType} is ${currentStock}, requested ${quantity}.`);
        }
      }

      // A. Create core transaction
      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'DAMAGE',
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType: null,
          toEntityId: null,
          quantity,
          notes: notes || `Bulk damage logged`,
          deliveryStatus: 'Delivered',
        },
      });

      // B. Link serialized serials and mark as DAMAGED
      if (product.isSerialized && barcodes.length > 0) {
        const dbSerials = await tx.productSerialNumber.findMany({
          where: {
            productId,
            barcode: { in: barcodes },
          },
        });

        if (dbSerials.length !== barcodes.length) {
          throw new Error(`Some barcodes for product "${product.name}" could not be found in the database.`);
        }

        if (fromEntityType) {
          const invalidSerials = dbSerials.filter(
            (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
          );
          if (invalidSerials.length > 0) {
            throw new Error(`Some barcodes for "${product.name}" are not present at the source location (${fromEntityType}).`);
          }
        }

        for (const serial of dbSerials) {
          await tx.productSerialNumber.update({
            where: { id: serial.id },
            data: {
              status: 'DAMAGED',
              currentLocationType: null,
              currentLocationId: null,
            },
          });

          await tx.transactionSerialNumber.create({
            data: {
              transactionId: invTx.id,
              serialNumberId: serial.id,
            },
          });
        }
      }

      createdTxs.push(invTx);
    }

    return createdTxs;
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transactions;
}

export async function getRecentReceivers() {
  await checkAuth();
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      receivedBy: { not: null },
    },
    select: {
      receivedBy: true,
    },
    distinct: ['receivedBy'],
  });
  return transactions.map(t => t.receivedBy).filter(Boolean);
}

export async function getRecentSuppliers() {
  await checkAuth();
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      fromEntityType: 'SUPPLIER',
      fromEntityId: { not: null },
    },
    select: {
      fromEntityId: true,
    },
    distinct: ['fromEntityId'],
  });
  return transactions.map(t => t.fromEntityId).filter(Boolean);
}

export async function createBulkRebrandTransactions(payload) {
  const { sourceProductId, targetProductId, remarks, mappings = [] } = payload;
  
  // Format mappings to the format processRebrand expects
  const barcodes = mappings.map(m => ({
    oldBarcode: m.sourceBarcode,
    newBarcode: m.targetBarcode,
    newSecondary: ''
  }));

  return processRebrand({
    oldProductId: sourceProductId,
    newProductId: targetProductId,
    quantity: mappings.length,
    notes: remarks,
    barcodes
  });
}

