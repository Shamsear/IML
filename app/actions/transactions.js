'use server';

import { prisma } from '@/lib/prisma';
import { generateId } from '@/lib/idGenerator';
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
    take: 400,
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
    const lastRecord = await tx.inventoryTransaction.findFirst({
      where: { id: { startsWith: 'TRAN' } },
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    let nextNum = 1;
    if (lastRecord) {
      const parts = lastRecord.id.split('-');
      const numPart = parts[parts.length - 1];
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const txId = `TRAN-${String(nextNum).padStart(5, '0')}`;

    const invTx = await tx.inventoryTransaction.create({
      data: {
        id: txId,
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
      // Find serials globally to give descriptive mismatches
      const globalSerials = await tx.productSerialNumber.findMany({
        where: {
          barcode: { in: barcodes },
        },
        include: {
          product: { select: { name: true } }
        }
      });

      const foundBarcodes = globalSerials.map(s => s.barcode);
      const missingBarcodes = barcodes.filter(b => !foundBarcodes.includes(b));
      if (missingBarcodes.length > 0) {
        throw new Error(`Some barcodes could not be found in the database: ${missingBarcodes.join(', ')}`);
      }

      const mismatchedSerials = globalSerials.filter(s => s.productId !== productId);
      if (mismatchedSerials.length > 0) {
        const mismatches = mismatchedSerials.map(s => `"${s.barcode}" (belongs to product "${s.product.name}")`).join(', ');
        throw new Error(`Some barcodes belong to different products: ${mismatches}`);
      }

      const dbSerials = globalSerials.filter(s => s.productId === productId);

      // Check serial states for outbound transactions
      if (fromEntityType) {
        const invalidSerials = dbSerials.filter(
          (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
        );
        if (invalidSerials.length > 0) {
          throw new Error(`Some selected barcodes are not present at the source location (${fromEntityType}).`);
        }
      }

      // Update location and status on the serial number rows in bulk (1 write)
      let nextStatus = 'AVAILABLE';
      if (transactionType === 'DAMAGE') nextStatus = 'DAMAGED';
      else if (transactionType === 'LOST') nextStatus = 'LOST';
      else if (toEntityType === 'CLIENT' || toEntityType === 'STAFF') nextStatus = 'USED';

      await tx.productSerialNumber.updateMany({
        where: {
          id: { in: dbSerials.map(s => s.id) }
        },
        data: {
          currentLocationType: toEntityType || null,
          currentLocationId: toEntityId || null,
          status: nextStatus,
        }
      });

      // Link the serials to this transaction log in bulk (1 write)
      await tx.transactionSerialNumber.createMany({
        data: dbSerials.map(serial => ({
          transactionId: invTx.id,
          serialNumberId: serial.id,
        }))
      });
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

    // 3. Update serials if serialized in bulk (3 writes total)
    if (oldProduct.isSerialized && barcodes.length > 0) {
      const oldBarcodes = barcodes.map(b => b.oldBarcode);
      const oldSerials = await tx.productSerialNumber.findMany({
        where: { barcode: { in: oldBarcodes } }
      });

      if (oldSerials.length !== barcodes.length) {
        throw new Error('Some source barcodes could not be found.');
      }

      // Mark old serials as REPLACED in bulk
      await tx.productSerialNumber.updateMany({
        where: { id: { in: oldSerials.map(s => s.id) } },
        data: {
          status: 'REPLACED',
          currentLocationType: null,
          currentLocationId: null,
        }
      });

      // Create new serial records linking back to old serials in bulk
      const newSerialsData = barcodes.map(item => {
        const matchingOld = oldSerials.find(s => s.barcode.toLowerCase() === item.oldBarcode.toLowerCase());
        return {
          productId: newProductId,
          barcode: item.newBarcode.trim(),
          secondaryBarcode: item.newSecondary ? item.newSecondary.trim() : null,
          currentLocationType: 'WAREHOUSE',
          status: 'AVAILABLE',
          replacesId: matchingOld.id
        };
      });

      await tx.productSerialNumber.createMany({
        data: newSerialsData,
        skipDuplicates: true
      });
    }
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
}

// 5. Query active stock of a store
export async function getStoreInventory(storeId) {
  await checkAuth();

  // 1. Fetch all active serialized items at this store, including product & brand
  const activeSerials = await prisma.productSerialNumber.findMany({
    where: {
      currentLocationType: 'STORE',
      currentLocationId: storeId,
      status: 'AVAILABLE',
    },
    select: {
      barcode: true,
      secondaryBarcode: true,
      status: true,
      productId: true,
      product: {
        select: {
          name: true,
          isSerialized: true,
          brand: { select: { name: true } }
        }
      }
    },
    orderBy: { barcode: 'asc' }
  });

  // 2. Fetch all bulk product transactions for this store to compute active stock
  const bulkTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { fromEntityType: 'STORE', fromEntityId: storeId },
        { toEntityType: 'STORE', toEntityId: storeId },
      ],
      product: {
        isSerialized: false, // only bulk products
      }
    },
    select: {
      productId: true,
      transactionType: true,
      fromEntityType: true,
      toEntityType: true,
      quantity: true,
      product: {
        select: {
          name: true,
          isSerialized: true,
          brand: { select: { name: true } }
        }
      }
    }
  });

  const inventoryMap = {};

  // Process serialized items (group by product in-memory)
  for (const s of activeSerials) {
    const prodId = s.productId;
    if (!inventoryMap[prodId]) {
      inventoryMap[prodId] = {
        productId: prodId,
        name: s.product.name,
        brandName: s.product.brand?.name || 'No Brand',
        isSerialized: true,
        quantity: 0,
        serials: []
      };
    }
    inventoryMap[prodId].quantity += 1;
    inventoryMap[prodId].serials.push({
      barcode: s.barcode,
      secondaryBarcode: s.secondaryBarcode,
      status: s.status
    });
  }

  // Process bulk items (compute net quantity in-memory)
  for (const tx of bulkTransactions) {
    const prodId = tx.productId;
    let netChange = 0;
    if (tx.toEntityType === 'STORE' && tx.toEntityId === storeId) {
      netChange = tx.quantity;
    } else if (tx.fromEntityType === 'STORE' && tx.fromEntityId === storeId) {
      netChange = -tx.quantity;
    }

    if (netChange !== 0) {
      if (!inventoryMap[prodId]) {
        inventoryMap[prodId] = {
          productId: prodId,
          name: tx.product.name,
          brandName: tx.product.brand?.name || 'No Brand',
          isSerialized: false,
          quantity: 0,
          serials: []
        };
      }
      inventoryMap[prodId].quantity += netChange;
    }
  }

  // Filter out any products that ended up with 0 or negative quantity
  return Object.values(inventoryMap).filter(item => item.quantity > 0);
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
        // Find serials globally to give descriptive mismatches
        const globalSerials = await tx.productSerialNumber.findMany({
          where: {
            barcode: { in: barcodes },
          },
          include: {
            product: { select: { name: true } }
          }
        });

        const foundBarcodes = globalSerials.map(s => s.barcode);
        const missingBarcodes = barcodes.filter(b => !foundBarcodes.includes(b));
        if (missingBarcodes.length > 0) {
          throw new Error(`Some barcodes for product "${product.name}" could not be found in the database: ${missingBarcodes.join(', ')}`);
        }

        const mismatchedSerials = globalSerials.filter(s => s.productId !== productId);
        if (mismatchedSerials.length > 0) {
          const mismatches = mismatchedSerials.map(s => `"${s.barcode}" (belongs to product "${s.product.name}")`).join(', ');
          throw new Error(`Some barcodes belong to different products instead of "${product.name}": ${mismatches}`);
        }

        const dbSerials = globalSerials.filter(s => s.productId === productId);

        if (fromEntityType) {
          const invalidSerials = dbSerials.filter(
            (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
          );
          if (invalidSerials.length > 0) {
            throw new Error(`Some barcodes for "${product.name}" are not present at the source location (${fromEntityType}).`);
          }
        }

        let nextStatus = 'AVAILABLE';
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF') nextStatus = 'USED';

        // Bulk update location and status (1 write)
        await tx.productSerialNumber.updateMany({
          where: {
            id: { in: dbSerials.map(s => s.id) }
          },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus,
          }
        });

        // Bulk link serials to transaction (1 write)
        await tx.transactionSerialNumber.createMany({
          data: dbSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id,
          }))
        });
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
            barcode: { in: barcodes },
          },
          include: {
            product: { select: { name: true } }
          }
        });

        if (existingSerials.length > 0) {
          const dupes = existingSerials.map(s => `"${s.barcode}" (linked to product "${s.product.name}")`).join(', ');
          throw new Error(`Some barcodes already exist in the database: ${dupes}`);
        }

        // 1. Bulk insert all new product serials (1 write)
        await tx.productSerialNumber.createMany({
          data: barcodes.map(barcode => ({
            productId,
            barcode: barcode.trim(),
            currentLocationType: toEntityType || 'WAREHOUSE',
            currentLocationId: toEntityId || null,
            status: 'AVAILABLE',
          })),
          skipDuplicates: true
        });

        // 2. Fetch the newly created serial records to get their IDs
        const newSerials = await tx.productSerialNumber.findMany({
          where: {
            productId,
            barcode: { in: barcodes }
          },
          select: { id: true }
        });

        // 3. Bulk insert the transaction-serial mappings (1 write)
        await tx.transactionSerialNumber.createMany({
          data: newSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id,
          }))
        });
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

        // Bulk mark serial records as DAMAGED (1 write)
        await tx.productSerialNumber.updateMany({
          where: {
            id: { in: dbSerials.map(s => s.id) }
          },
          data: {
            status: 'DAMAGED',
            currentLocationType: null,
            currentLocationId: null,
          }
        });

        // Bulk insert the transaction-serial mappings (1 write)
        await tx.transactionSerialNumber.createMany({
          data: dbSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id,
          }))
        });
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
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
  const distinct = Array.from(new Set(transactions.map(t => t.receivedBy).filter(Boolean)));
  return distinct;
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
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
  const distinct = Array.from(new Set(transactions.map(t => t.fromEntityId).filter(Boolean)));
  return distinct;
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

