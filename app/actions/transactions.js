'use server';

import { prisma } from '@/lib/prisma';
import { generateId } from '@/lib/idGenerator';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { uploadToImageKit } from '@/lib/imagekit';

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
          brandId: true,
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
      else if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

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

  if (!oldProduct.isSerialized) {
    const inbound = await prisma.inventoryTransaction.aggregate({
      where: { productId: oldProductId, toEntityType: 'WAREHOUSE' },
      _sum: { quantity: true },
    });
    const outbound = await prisma.inventoryTransaction.aggregate({
      where: { productId: oldProductId, fromEntityType: 'WAREHOUSE' },
      _sum: { quantity: true },
    });
    const currentStock = (inbound._sum.quantity || 0) - (outbound._sum.quantity || 0);
    if (currentStock < quantity) {
      throw new Error(`Insufficient stock for rebranding. Current warehouse stock is ${currentStock}, requested ${quantity}.`);
    }
  }

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
    deliverySupervisorId,
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
          deliverySupervisorId: deliverySupervisorId || null,
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
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

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
export async function createBulkReceiveTransactions(formData) {
  await checkAuth();

  const fromEntityType = formData.get('fromEntityType') || 'SUPPLIER';
  const fromEntityId = formData.get('fromEntityId') || 'Main Supplier';
  const toEntityType = formData.get('toEntityType') || 'WAREHOUSE';
  const toEntityId = formData.get('toEntityId') || null;
  const receivedBy = formData.get('receivedBy') || null;
  const itemsJson = formData.get('items');
  const items = JSON.parse(itemsJson || '[]');

  if (items.length === 0) throw new Error('At least one product item is required for bulk receive');

  // Auto-generate Delivery Note number for the entire receive batch
  const autoDeliveryNote = `DN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      let { productId, quantity, barcodes = [], notes, manufactureDate, expiryDate, isNewProduct } = item;

      if (isNewProduct) {
        // Register the product inline!
        const { prodName, prodType, prodBrandId, prodCategory, prodItemCode, prodLowStockAlert = '10', prodIsReturnable } = item;

        if (!prodName) throw new Error(`Product name is required for inline product registration at entry #${idx + 1}`);
        if (!prodBrandId) throw new Error(`Brand is required for inline product registration at entry #${idx + 1}`);

        // Upload the image file if it exists in the FormData
        const imageFile = formData.get(`item_${idx}_imageFile`);
        let imageUrl = null;
        if (imageFile && imageFile.size > 0) {
          const savedPath = await uploadToImageKit(imageFile);
          if (savedPath) imageUrl = savedPath;
        }

        const newProductId = await generateId('product', 'PROD', 4);
        const newProduct = await tx.product.create({
          data: {
            id: newProductId,
            name: prodName,
            isSerialized: prodType === 'SIM' || prodType === 'ROUTER',
            productType: prodType,
            brandId: prodBrandId,
            category: prodCategory || 'General',
            itemCode: prodItemCode || '',
            lowStockAlert: parseInt(prodLowStockAlert, 10) || 10,
            isReturnable: !!prodIsReturnable,
            imageUrl,
          }
        });

        // Set the newly created product's ID
        productId = newProduct.id;
        
        // Ensure quantity is correct if newly registered is serialized
        if (newProduct.isSerialized) {
          quantity = barcodes.length;
        }
      }

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
          manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
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
    transactionType = 'DAMAGE', // 'DAMAGE' or 'LOST'
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  const resolvedType = transactionType === 'LOST' ? 'LOST' : 'DAMAGE';
  const serialStatus = resolvedType === 'LOST' ? 'LOST' : 'DAMAGED';

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
          transactionType: resolvedType,
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType: null,
          toEntityId: null,
          quantity,
          notes: notes || `Bulk ${resolvedType.toLowerCase()} logged`,
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

        // Bulk mark serial records as DAMAGED or LOST (1 write)
        await tx.productSerialNumber.updateMany({
          where: {
            id: { in: dbSerials.map(s => s.id) }
          },
          data: {
            status: serialStatus,
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

export async function createBulkRebrandTransactions(formData) {
  await checkAuth();

  const sourceProductId = formData.get('sourceProductId');
  const remarks = formData.get('remarks');
  const mappingsJson = formData.get('mappings');
  const mappings = JSON.parse(mappingsJson || '[]');

  const isNewProduct = formData.get('isNewProduct') === 'true';
  const targetProductImage = formData.get('targetProductImage');
  let newImageUrl = null;

  if (targetProductImage && targetProductImage.size > 0) {
    const savedPath = await uploadToImageKit(targetProductImage);
    if (savedPath) newImageUrl = savedPath;
  }

  let finalTargetProductId = formData.get('targetProductId');

  if (isNewProduct) {
    const prodName = formData.get('prodName');
    const prodBrandId = formData.get('prodBrandId');
    const prodItemCode = formData.get('prodItemCode') || null;
    const prodCategory = formData.get('prodCategory') || 'SIM';
    const prodLowStockAlert = formData.get('prodLowStockAlert') || '10';
    const prodIsReturnable = formData.get('prodIsReturnable') === 'true';

    // Get last product ID dynamically to prevent race conditions
    const lastProduct = await prisma.product.findFirst({
      where: { id: { startsWith: 'PROD' } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    let lastProdNum = 0;
    if (lastProduct) {
      const match = lastProduct.id.match(/\d+/);
      if (match) lastProdNum = parseInt(match[0], 10);
    }
    const newProdId = `PROD-${String(lastProdNum + 1).padStart(5, '0')}`;

    // Create the brand-new target catalog product
    const newProduct = await prisma.product.create({
      data: {
        id: newProdId,
        name: prodName.trim(),
        brandId: prodBrandId,
        itemCode: prodItemCode ? prodItemCode.trim() : null,
        category: prodCategory,
        imageUrl: newImageUrl,
        isReturnable: prodIsReturnable,
        isPublic: true,
        isSerialized: true,
        stockCap: parseInt(prodLowStockAlert, 10) || 10,
      }
    });

    finalTargetProductId = newProduct.id;
    revalidatePath('/dashboard/products');
  } else {
    // If a new image was uploaded for an existing product, update its imageUrl
    if (newImageUrl) {
      await prisma.product.update({
        where: { id: finalTargetProductId },
        data: { imageUrl: newImageUrl }
      });
      revalidatePath('/dashboard/products');
    }
  }

  // Format mappings to the format processRebrand expects
  const barcodes = mappings.map(m => ({
    oldBarcode: m.sourceBarcode,
    newBarcode: m.targetBarcode,
    newSecondary: ''
  }));

  const nonSerializedQty = parseInt(formData.get('nonSerializedQty') || '0', 10);
  const qty = barcodes.length > 0 ? barcodes.length : nonSerializedQty;

  return processRebrand({
    oldProductId: sourceProductId,
    newProductId: finalTargetProductId,
    quantity: qty,
    notes: remarks,
    barcodes
  });
}

// Update only the notes and/or deliveryNote of an existing transaction
export async function updateTransactionNotes(id, { notes, deliveryNote }) {
  await checkAuth();

  if (!id) throw new Error('Transaction ID is required');

  await prisma.inventoryTransaction.update({
    where: { id },
    data: {
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(deliveryNote !== undefined ? { deliveryNote: deliveryNote || null } : {}),
    },
  });

  revalidatePath('/dashboard/inbound');
  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/damage');
  revalidatePath('/dashboard/rebrand');

  return { success: true };
}

// Hard-delete a transaction — stock recalculates automatically from remaining rows
export async function deleteTransaction(id) {
  await checkAuth();

  if (!id) throw new Error('Transaction ID is required');

  const txRecord = await prisma.inventoryTransaction.findUnique({
    where: { id },
    include: {
      serialNumbers: {
        include: { serialNumber: true }
      },
      product: true
    }
  });

  if (!txRecord) throw new Error('Transaction not found');

  await prisma.$transaction(async (tx) => {
    if (txRecord.product.isSerialized && txRecord.serialNumbers.length > 0) {
      const oldSerials = txRecord.serialNumbers.map(s => s.serialNumber);
      
      if (txRecord.transactionType === 'RECEIVE' || txRecord.transactionType === 'REBRAND_IN' || txRecord.transactionType === 'RETURN') {
        await tx.productSerialNumber.deleteMany({
          where: { id: { in: oldSerials.map(s => s.id) } }
        });
      } else {
        await tx.productSerialNumber.updateMany({
          where: { id: { in: oldSerials.map(s => s.id) } },
          data: {
            currentLocationType: txRecord.fromEntityType || 'WAREHOUSE',
            currentLocationId: txRecord.fromEntityId || null,
            status: 'AVAILABLE'
          }
        });
      }
    }
    // TransactionSerialNumber rows cascade-delete via schema onDelete: Cascade
    await tx.inventoryTransaction.delete({ where: { id } });
  });

  revalidatePath('/dashboard/inbound');
  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/damage');
  revalidatePath('/dashboard/rebrand');
  revalidatePath('/dashboard/loss');

  return { success: true };
}
// Full Edit for Transactions
export async function updateFullTransaction(id, payload) {
  await checkAuth();

  const {
    timestamp,
    transactionType,
    productId,
    quantity,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    notes,
    deliveryNote,
    barcodes = [],
  } = payload;

  const txRecord = await prisma.inventoryTransaction.findUnique({
    where: { id },
    include: {
      serialNumbers: {
        include: { serialNumber: true }
      }
    }
  });

  if (!txRecord) throw new Error('Transaction not found');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

  if (txRecord.transactionType === 'RECEIVE') {
    const subsequentOutbound = await prisma.inventoryTransaction.findFirst({
      where: {
        productId: txRecord.productId,
        transactionType: { in: ['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT'] },
        timestamp: { gt: txRecord.timestamp }
      }
    });

    if (subsequentOutbound) {
      throw new Error('1st delete the outbound transactions, then only inbound can be edited.');
    }
  }

  await prisma.$transaction(async (tx) => {
    if (product.isSerialized && txRecord.serialNumbers.length > 0) {
      const oldSerials = txRecord.serialNumbers.map(s => s.serialNumber);
      
      if (txRecord.transactionType === 'RECEIVE' || txRecord.transactionType === 'REBRAND_IN' || txRecord.transactionType === 'RETURN') {
        await tx.productSerialNumber.deleteMany({
          where: { id: { in: oldSerials.map(s => s.id) } }
        });
      } else {
        await tx.productSerialNumber.updateMany({
          where: { id: { in: oldSerials.map(s => s.id) } },
          data: {
            currentLocationType: txRecord.fromEntityType || 'WAREHOUSE',
            currentLocationId: txRecord.fromEntityId || null,
            status: 'AVAILABLE'
          }
        });
      }
    }

    await tx.inventoryTransaction.delete({ where: { id } });

    const invTx = await tx.inventoryTransaction.create({
      data: {
        id,
        productId,
        transactionType,
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        quantity,
        notes,
        deliveryNote,
        timestamp: new Date(timestamp),
      }
    });

    if (product.isSerialized && barcodes.length > 0) {
      if (transactionType === 'RECEIVE' || transactionType === 'REBRAND_IN' || transactionType === 'RETURN') {
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
      } else {
        let nextStatus = 'AVAILABLE';
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';
        if (transactionType === 'DAMAGE') nextStatus = 'DAMAGED';
        if (transactionType === 'LOST') nextStatus = 'LOST';
        
        await tx.productSerialNumber.updateMany({
          where: {
            productId,
            barcode: { in: barcodes }
          },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus
          }
        });
      }

      const updatedSerials = await tx.productSerialNumber.findMany({
        where: { productId, barcode: { in: barcodes } },
        select: { id: true }
      });

      await tx.transactionSerialNumber.createMany({
        data: updatedSerials.map(serial => ({
          transactionId: invTx.id,
          serialNumberId: serial.id
        }))
      });
    }
  });

  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/inbound');
  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/damage');
  revalidatePath('/dashboard/rebrand');
  revalidatePath('/dashboard/brands/[id]');
  revalidatePath('/portal/brand/[secretKey]');
  return { success: true };
}
// Create a single duplicate transaction
export async function createSingleTransaction(payload) {
  await checkAuth();

  const {
    timestamp,
    transactionType,
    productId,
    quantity,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    notes,
    deliveryNote,
    barcodes = [],
  } = payload;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

  await prisma.$transaction(async (tx) => {
    // 1. Create transaction record
    const invTx = await tx.inventoryTransaction.create({
      data: {
        productId,
        transactionType,
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        quantity,
        notes,
        deliveryNote,
        timestamp: new Date(timestamp),
        deliveryStatus: 'Delivered', // Assume delivered if copied
      }
    });

    // 2. Handle serial numbers if serialized
    if (product.isSerialized && barcodes.length > 0) {
      if (transactionType === 'RECEIVE' || transactionType === 'REBRAND_IN' || transactionType === 'RETURN') {
        const existingSerials = await tx.productSerialNumber.findMany({
          where: { barcode: { in: barcodes } },
          include: { product: { select: { name: true } } }
        });
        if (existingSerials.length > 0) {
          const dupes = existingSerials.map(s => `"${s.barcode}" (linked to "${s.product.name}")`).join(', ');
          throw new Error(`Some barcodes already exist: ${dupes}`);
        }

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
      } else {
        const dbSerials = await tx.productSerialNumber.findMany({
          where: { barcode: { in: barcodes } }
        });
        const invalidSerials = dbSerials.filter(s => s.productId !== productId || s.currentLocationType !== fromEntityType);
        if (invalidSerials.length > 0) {
          throw new Error(`Some barcodes are not available at the source location.`);
        }

        let nextStatus = 'AVAILABLE';
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';
        if (transactionType === 'DAMAGE') nextStatus = 'DAMAGED';
        if (transactionType === 'LOST') nextStatus = 'LOST';
        
        await tx.productSerialNumber.updateMany({
          where: { productId, barcode: { in: barcodes } },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus
          }
        });
      }

      const newSerials = await tx.productSerialNumber.findMany({
        where: { productId, barcode: { in: barcodes } },
        select: { id: true }
      });

      await tx.transactionSerialNumber.createMany({
        data: newSerials.map(serial => ({
          transactionId: invTx.id,
          serialNumberId: serial.id
        }))
      });
    }
  });

  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/inbound');
  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/damage');
  revalidatePath('/dashboard/rebrand');
  revalidatePath('/dashboard/brands/[id]');
  revalidatePath('/portal/brand/[secretKey]');
  return { success: true };
}

// Fetch a single transaction by ID and format it for copy-prefill
export async function getTransactionById(txId) {
  await checkAuth();

  if (!txId) return null;

  const tx = await prisma.inventoryTransaction.findUnique({
    where: { id: txId },
    include: {
      product: {
        select: { id: true, isSerialized: true }
      }
    }
  });

  if (!tx) return null;

  return {
    id: `temp-${Date.now()}-0`,
    productId: tx.productId,
    quantity: tx.product.isSerialized ? 0 : tx.quantity,
    barcodesInput: '',
    barcodes: [],
    notes: tx.notes || '',
    isNewProduct: false,
    isExpanded: true,
    error: '',
    rangeStart: '',
    rangeEnd: '',
    rangeMode: false,
    manufactureDate: '',
    expiryDate: '',
    fromEntityType: tx.fromEntityType,
    fromEntityId: tx.fromEntityId,
    toEntityType: tx.toEntityType,
    toEntityId: tx.toEntityId,
    transactionType: tx.transactionType,
    deliverySupervisorId: tx.deliverySupervisorId,
    prodName: '',
    prodType: 'NORMAL',
    prodBrandId: '',
    prodCategory: 'General',
    prodItemCode: '',
    prodLowStockAlert: '10',
    prodIsReturnable: false,
    prodImageFile: null,
    prodImagePreview: '',
  };
}

// Fetch all transactions associated with a Delivery Note and format them for copy
export async function getTransactionsByDeliveryNote(deliveryNote) {
  await checkAuth();

  if (!deliveryNote) return [];

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { deliveryNote },
    include: {
      product: {
        select: {
          id: true,
          isSerialized: true
        }
      }
    },
    orderBy: { timestamp: 'asc' }
  });

  return transactions.map((tx, idx) => ({
    id: `temp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
    productId: tx.productId,
    quantity: tx.product.isSerialized ? 0 : tx.quantity, // Serialized products need new barcodes, so start at 0
    barcodesInput: '',
    barcodes: [],
    notes: tx.notes || '',
    isNewProduct: false,
    isExpanded: idx === 0, // expand first item by default
    error: '',
    rangeStart: '',
    rangeEnd: '',
    rangeMode: false,
    manufactureDate: '',
    expiryDate: '',
    fromEntityType: tx.fromEntityType,
    fromEntityId: tx.fromEntityId,
    toEntityType: tx.toEntityType,
    toEntityId: tx.toEntityId,
    transactionType: tx.transactionType,
    deliverySupervisorId: tx.deliverySupervisorId,
    // Inline product registration fields (unused for existing products)
    prodName: '',
    prodType: 'NORMAL',
    prodBrandId: '',
    prodCategory: 'General',
    prodItemCode: '',
    prodLowStockAlert: '10',
    prodIsReturnable: false,
    prodImageFile: null,
    prodImagePreview: '',
  }));
}

// Process Outbound Returns & Usage
export async function processOutboundReturns(returnsPayload) {
  await checkAuth();

  if (!Array.isArray(returnsPayload) || returnsPayload.length === 0) {
    throw new Error('No items provided for processing');
  }

  await prisma.$transaction(async (tx) => {
    for (const item of returnsPayload) {
      const { transactionId, actionType, qty, notes } = item;

      if (!transactionId || !actionType) throw new Error('Missing required fields');

      const originalTx = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!originalTx) throw new Error(`Transaction not found: ${transactionId}`);
      if (originalTx.transactionType !== 'ISSUE') throw new Error(`Cannot process return for non-outbound transaction: ${transactionId}`);

      const processQty = parseInt(qty || '0', 10);
      const remainingQty = originalTx.quantity - (originalTx.returnedQty || 0);

      if (actionType === 'RETURN') {
        if (processQty <= 0) throw new Error('Return quantity must be greater than 0');
        if (processQty > remainingQty) throw new Error(`Cannot return ${processQty}. Only ${remainingQty} unreturned items remaining.`);

        const newReturnedQty = (originalTx.returnedQty || 0) + processQty;
        const newStatus = newReturnedQty >= originalTx.quantity ? 'RETURNED' : 'PARTIAL';
        const newNotes = originalTx.returnNotes ? `${originalTx.returnNotes} | ${notes || 'Returned'}` : (notes || 'Returned');

        // 1. Update original Outbound transaction
        await tx.inventoryTransaction.update({
          where: { id: transactionId },
          data: {
            returnedQty: newReturnedQty,
            returnStatus: newStatus,
            returnNotes: newNotes,
          }
        });

        // 2. Create INBOUND transaction to return stock to Warehouse
        await tx.inventoryTransaction.create({
          data: {
            productId: originalTx.productId,
            transactionType: 'INBOUND',
            fromEntityType: originalTx.toEntityType,
            fromEntityId: originalTx.toEntityId,
            toEntityType: 'WAREHOUSE',
            toEntityId: null,
            quantity: processQty,
            notes: `Auto-generated Return from Outbound ${transactionId}. ${notes || ''}`,
            deliveryStatus: 'Delivered',
          }
        });

      } else if (actionType === 'USED') {
        // Just mark the entire remaining quantity as used
        const newNotes = originalTx.returnNotes ? `${originalTx.returnNotes} | ${notes || 'Marked Used'}` : (notes || 'Marked Used');
        
        await tx.inventoryTransaction.update({
          where: { id: transactionId },
          data: {
            returnStatus: 'USED',
            returnNotes: newNotes,
            returnedQty: originalTx.quantity, // Set to max so it's fully processed
          }
        });
      } else {
        throw new Error(`Unknown action type: ${actionType}`);
      }
    }
  });

  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/returns');
  revalidatePath('/dashboard/products');
  return { success: true };
}

export async function updateBulkIssueTransactions(deliveryNote, payload) {
  await checkAuth();

  const {
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    deliverySupervisorId,
    items = [],
  } = payload;

  if (!deliveryNote) throw new Error('Delivery Note is required for update');
  if (items.length === 0) throw new Error('At least one product item is required for bulk issue');

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: { deliveryNote, transactionType: 'ISSUE' },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing delivery note not found or no issue transactions');

  const transactions = await prisma.$transaction(async (tx) => {
    // 1. REVERT OLD TRANSACTIONS
    for (const oldTx of oldTxs) {
      if (oldTx.product.isSerialized && oldTx.serialNumbers.length > 0) {
        const oldSerials = oldTx.serialNumbers.map(s => s.serialNumber);
        await tx.productSerialNumber.updateMany({
          where: { id: { in: oldSerials.map(s => s.id) } },
          data: {
            currentLocationType: oldTx.fromEntityType || 'WAREHOUSE',
            currentLocationId: oldTx.fromEntityId || null,
            status: 'AVAILABLE'
          }
        });
      }
      await tx.inventoryTransaction.delete({ where: { id: oldTx.id } });
    }

    // 2. CREATE NEW TRANSACTIONS
    const createdTxs = [];

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes } = item;

      if (!productId) throw new Error('Product ID is required for all items');
      if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      if (!product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
        const inboundSum = await tx.inventoryTransaction.aggregate({
          where: { productId, toEntityType: fromEntityType, toEntityId: fromEntityId || null },
          _sum: { quantity: true },
        });
        const outboundSum = await tx.inventoryTransaction.aggregate({
          where: { productId, fromEntityType: fromEntityType, fromEntityId: fromEntityId || null },
          _sum: { quantity: true },
        });
        const inQty = inboundSum._sum.quantity || 0;
        const outQty = outboundSum._sum.quantity || 0;
        const currentStock = inQty - outQty;

        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Current stock is ${currentStock}, requested ${quantity}.`);
        }
      }

      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'ISSUE',
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType,
          toEntityId: toEntityId || null,
          quantity,
          notes,
          deliveryNote, // Reuse existing!
          deliverySupervisorId: deliverySupervisorId || null,
          deliveryStatus: 'Delivered',
        }
      });

      if (product.isSerialized) {
        if (barcodes.length !== quantity) {
          throw new Error(`Quantity (${quantity}) does not match scanned barcodes count (${barcodes.length}) for product "${product.name}"`);
        }
        
        const dbSerials = await tx.productSerialNumber.findMany({
          where: { barcode: { in: barcodes } }
        });

        const missing = barcodes.filter(b => !dbSerials.some(s => s.barcode === b));
        if (missing.length > 0) throw new Error(`Barcodes not found in database: ${missing.join(', ')}`);

        const invalidSerials = dbSerials.filter(s => s.productId !== productId || s.currentLocationType !== fromEntityType);
        if (invalidSerials.length > 0) throw new Error(`Some barcodes are not available at the source location for "${product.name}".`);

        let nextStatus = 'AVAILABLE';
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

        await tx.productSerialNumber.updateMany({
          where: { id: { in: dbSerials.map(s => s.id) } },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus
          }
        });

        await tx.transactionSerialNumber.createMany({
          data: dbSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id
          }))
        });
      }

      createdTxs.push(invTx);
    }
    return createdTxs;
  });

  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/transactions');
  return transactions;
}

export async function updateBulkReceiveTransactions(deliveryNote, formData) {
  await checkAuth();

  const fromEntityType = formData.get('fromEntityType') || 'SUPPLIER';
  const fromEntityId = formData.get('fromEntityId');
  const toEntityType = formData.get('toEntityType') || 'WAREHOUSE';
  const toEntityId = formData.get('toEntityId');
  const receivedBy = formData.get('receivedBy') || null;
  const itemsJson = formData.get('items');
  const items = JSON.parse(itemsJson || '[]');

  if (!deliveryNote) throw new Error('Delivery Note is required for update');
  if (items.length === 0) throw new Error('At least one product item is required for receive');

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: { deliveryNote, transactionType: 'RECEIVE' },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing delivery note not found or no receive transactions');

  const transactions = await prisma.$transaction(async (tx) => {
    // 1. REVERT OLD TRANSACTIONS
    for (const oldTx of oldTxs) {
      if (oldTx.product.isSerialized && oldTx.serialNumbers.length > 0) {
        const oldSerials = oldTx.serialNumbers.map(s => s.serialNumber);
        await tx.productSerialNumber.deleteMany({
          where: { id: { in: oldSerials.map(s => s.id) } }
        });
      }
      await tx.inventoryTransaction.delete({ where: { id: oldTx.id } });
    }

    // 2. CREATE NEW TRANSACTIONS
    const createdTxs = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      let { isNewProduct, productId, quantity, barcodes = [], notes, manufactureDate, expiryDate } = item;

      if (isNewProduct) {
        const { prodName, prodType, prodBrandId, prodCategory, prodItemCode, prodLowStockAlert, prodIsReturnable } = item;
        let imageUrl = null;
        const newProduct = await tx.product.create({
          data: {
            name: prodName,
            type: prodType,
            brandId: prodBrandId,
            category: prodCategory || null,
            itemCode: prodItemCode || null,
            isSerialized: (prodType === 'SIM' || prodType === 'ROUTER'),
            isReturnable: prodIsReturnable,
            lowStockAlert: prodLowStockAlert ? parseInt(prodLowStockAlert, 10) : 0,
            imageUrl: imageUrl,
          }
        });
        productId = newProduct.id;
      }

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error(`Product not found`);

      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'RECEIVE',
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType,
          toEntityId: toEntityId || null,
          quantity,
          notes,
          deliveryNote, // Reuse existing!
        }
      });

      if (product.isSerialized) {
        if (barcodes.length !== quantity) {
          throw new Error(`Quantity does not match barcodes count`);
        }

        const existingSerials = await tx.productSerialNumber.findMany({
          where: { barcode: { in: barcodes } },
          include: { product: { select: { name: true } } }
        });

        if (existingSerials.length > 0) {
          const dupes = existingSerials.map(s => `"${s.barcode}" (linked to "${s.product.name}")`).join(', ');
          throw new Error(`Some barcodes already exist: ${dupes}`);
        }

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

        const newSerials = await tx.productSerialNumber.findMany({
          where: { productId, barcode: { in: barcodes } },
          select: { id: true }
        });

        await tx.transactionSerialNumber.createMany({
          data: newSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id
          }))
        });
      }

      createdTxs.push(invTx);
    }
    return createdTxs;
  });

  revalidatePath('/dashboard/inbound');
  revalidatePath('/dashboard/transactions');
  return transactions;
}

export async function getRecentDirectSellers() {
  await checkAuth();
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { toEntityType: 'DIRECT' },
    select: { toEntityId: true },
    distinct: ['toEntityId'],
    orderBy: { timestamp: 'desc' },
    take: 20
  });
  return transactions.map(t => t.toEntityId).filter(Boolean);
}
