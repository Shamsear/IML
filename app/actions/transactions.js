'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { uploadToImageKit } from '@/lib/imagekit';
import { revalidateInventory } from '@/lib/revalidation';

function safeNotifyTransaction(payload) {
  import('@/lib/push')
    .then((m) => m.notifyTransaction(payload))
    .catch(() => {});
}

import { requireAuth, requireAdmin, requireWritePermission } from '@/lib/auth-guard';
import { generateId } from '@/lib/idGenerator';
import {
  generateTxId,
  generateBatchTxIds,
  generateSkuCode,
  generateCustomRef,
  parseTransactionDate,
  mergeNotes,
  getStockAtLocation,
  batchGetStock,
  validateSerials,
  computeSerialStatus,
  bulkUpdateSerials,
  linkSerialsToTransaction,
  processSerials,
} from '@/lib/ledger';

// Re-export for backward compatibility (used by staff.js, products.js)
export { generateCustomRef, getStockAtLocation, parseTransactionDate };

async function checkAuth() {
  await requireAuth();
}

async function checkWriteAuth() {
  await requireWritePermission();
}

function revalidateTransactionPaths(moduleOrOptions = {}) {
  if (typeof moduleOrOptions === 'string') {
    revalidateInventory({ module: moduleOrOptions });
  } else if (Array.isArray(moduleOrOptions)) {
    revalidateInventory({ extraPaths: moduleOrOptions });
  } else {
    revalidateInventory(moduleOrOptions);
  }
}

// 2. Fetch all transactions
export async function getTransactions(filters = {}) {
  await checkAuth();
  const { search, type, productId, page = 1, pageSize = 50 } = filters;

  const where = {};
  if (type && type !== 'ALL') {
    where.transactionType = type;
  }
  if (productId && productId !== 'ALL') {
    where.productId = productId;
  }
  if (search) {
    const searchString = String(search).trim();
    where.OR = [
      { deliveryNote: { contains: searchString, mode: 'insensitive' } },
      { toEntityId: { contains: searchString, mode: 'insensitive' } },
      { fromEntityId: { contains: searchString, mode: 'insensitive' } },
      { product: { name: { contains: searchString, mode: 'insensitive' } } }
    ];
  }

  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            isSerialized: true,
            brandId: true,
            brand: { select: { name: true } },
            imageUrl: true,
          }
        }
      }
    }),
    prisma.inventoryTransaction.count({ where })
  ]);

  return { transactions, totalCount };
}

// 3. Create a transaction (Receive, Issue, Return, Damage)
export async function createTransaction(data) {
  await checkWriteAuth();

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
    transactionDate,
    barcodes = [], // Used for serialized products
  } = data;

  if (!productId) throw new Error('Product ID is required');
  if (!transactionType) throw new Error('Transaction Type is required');
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: { select: { name: true } }
    }
  });

  if (!product) throw new Error('Product not found');

  // Verify stock levels for outbound transactions of bulk products
  if (!product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
    const currentStock = await getStockAtLocation(productId, fromEntityType, fromEntityId);
    if (currentStock < quantity) {
      throw new Error(`Insufficient stock. Current stock at ${fromEntityType} is ${currentStock}, requested ${quantity}.`);
    }
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // A. Create the core ledger transaction
    const txId = await generateTxId(tx, 'inventoryTransaction', 'TRAN', 5);

    // Generate proper delivery note for RECEIVE and RETURN transactions
    let finalDeliveryNote = deliveryNote;
    if ((transactionType === 'RECEIVE' || transactionType === 'RETURN') && (!deliveryNote || !deliveryNote.trim())) {
      const brandName = product.brand?.name || 'General';
      const typeCode = transactionType === 'RETURN' ? 'RTN' : 'REC';
      finalDeliveryNote = await generateCustomRef(tx, typeCode, brandName, transactionDate);
    } else if (deliveryNote && deliveryNote.trim()) {
      finalDeliveryNote = deliveryNote.trim();
    } else {
      finalDeliveryNote = null;
    }

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
        deliveryNote: finalDeliveryNote,
        deliveryStatus,
        notes,
        receivedBy,
        timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
      },
    });

    if (transactionType === 'ISSUE' && toEntityType === 'STORE' && toEntityId) {
      await tx.brand.update({
        where: { id: product.brandId },
        data: {
          stores: {
            connect: { id: toEntityId }
          }
        }
      });
    }

    // B. Handle Serialized Barcode Updates
    if (product.isSerialized && barcodes.length > 0) {
      await processSerials(tx, barcodes, productId, transactionType, { entityType: toEntityType, entityId: toEntityId }, invTx.id, {
        fromEntityType,
        fromEntityId,
        direction: fromEntityType ? 'outbound' : 'inbound',
      });
    }

    return invTx;
  }, { timeout: 20000 });

  revalidateTransactionPaths();

  safeNotifyTransaction({
    type: transactionType,
    productName: product.name,
    quantity,
    deliveryNote: transaction.deliveryNote,
    destinationOrSource: toEntityId || fromEntityId,
    brandName: product.brand?.name,
  });

  return transaction;
}

// 4. Rebrand items (Subtract A, Add B, Link Serials)
export async function processRebrand(data) {
  await checkWriteAuth();

  const {
    oldProductId,
    newProductId,
    quantity,
    notes,
    barcodes = [],
    deliveryNote: customDn,
    transactionDate,
  } = data;

  if (!oldProductId || !newProductId) throw new Error('Both old and new products are required');
  if (!quantity || quantity <= 0) throw new Error('Rebrand quantity must be greater than 0');

  const [oldProduct, newProduct] = await Promise.all([
    prisma.product.findUnique({ 
      where: { id: oldProductId },
      include: { brand: { select: { name: true } } }
    }),
    prisma.product.findUnique({ 
      where: { id: newProductId },
      include: { brand: { select: { name: true } } }
    }),
  ]);

  if (!oldProduct || !newProduct) throw new Error('Products not found');

  if (!oldProduct.isSerialized) {
    const currentStock = await getStockAtLocation(oldProductId, 'WAREHOUSE', null);
    if (currentStock < quantity) {
      throw new Error(`Insufficient stock for rebranding. Current warehouse stock is ${currentStock}, requested ${quantity}.`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const brandName = oldProduct.brand?.name || newProduct.brand?.name || 'General';
    const deliveryNote = customDn || await generateCustomRef(tx, 'RBD', brandName, transactionDate);
    const parsedDate = transactionDate ? parseTransactionDate(transactionDate) : undefined;

    // 1. Log subtraction of old product (from Warehouse)
    const outTx = await tx.inventoryTransaction.create({
      data: {
        productId: oldProductId,
        transactionType: 'REBRAND_OUT',
        fromEntityType: 'WAREHOUSE',
        quantity,
        deliveryNote,
        notes: `Rebrand output -> ${newProduct.name}. ${notes || ''}`,
        timestamp: parsedDate,
      },
    });

    // 2. Log addition of new product (to Warehouse)
    const inTx = await tx.inventoryTransaction.create({
      data: {
        productId: newProductId,
        transactionType: 'REBRAND_IN',
        toEntityType: 'WAREHOUSE',
        quantity,
        deliveryNote,
        notes: `Rebrand input <- ${oldProduct.name}. ${notes || ''}`,
        timestamp: parsedDate,
      },
    });

    // 3. Update serials if serialized in bulk
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

      // Link old serials to outTx
      await tx.transactionSerialNumber.createMany({
        data: oldSerials.map(s => ({
          transactionId: outTx.id,
          serialNumberId: s.id,
        })),
        skipDuplicates: true
      });

      // Create new serial records linking back to old serials in bulk
      for (const item of barcodes) {
        const matchingOld = oldSerials.find(s => s.barcode.toLowerCase() === item.oldBarcode.toLowerCase());
        const createdSerial = await tx.productSerialNumber.create({
          data: {
            productId: newProductId,
            barcode: item.newBarcode.trim(),
            secondaryBarcode: item.newSecondary ? item.newSecondary.trim() : null,
            currentLocationType: 'WAREHOUSE',
            status: 'AVAILABLE',
            replacesId: matchingOld ? matchingOld.id : null
          }
        });

        // Link new serial to inTx
        await tx.transactionSerialNumber.create({
          data: {
            transactionId: inTx.id,
            serialNumberId: createdSerial.id,
          }
        });
      }
    }

    return { deliveryNote, outTx, inTx };
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/rebrand');
  return result;
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
          id: true,
          name: true,
          itemCode: true,
          imageUrl: true,
          isSerialized: true,
          brand: { select: { name: true } }
        }
      }
    },
    orderBy: { barcode: 'asc' }
  });

  // 2. Fetch all bulk product transactions for this store grouped and summed at database level
  const [toTransactions, fromTransactions] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        toEntityType: 'STORE',
        toEntityId: storeId,
        product: { isSerialized: false }
      },
      _sum: { quantity: true }
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        fromEntityType: 'STORE',
        fromEntityId: storeId,
        product: { isSerialized: false }
      },
      _sum: { quantity: true }
    })
  ]);

  const netQuantities = new Map();
  toTransactions.forEach(t => {
    netQuantities.set(t.productId, (t._sum.quantity || 0));
  });
  fromTransactions.forEach(t => {
    const current = netQuantities.get(t.productId) || 0;
    netQuantities.set(t.productId, current - (t._sum.quantity || 0));
  });

  const activeBulkProductIds = [];
  for (const [prodId, qty] of netQuantities.entries()) {
    if (qty > 0) {
      activeBulkProductIds.push(prodId);
    }
  }

  const bulkProducts = await prisma.product.findMany({
    where: { id: { in: activeBulkProductIds } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      brand: { select: { name: true } }
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
        imageUrl: s.product.imageUrl || null,
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

  // Process bulk items
  bulkProducts.forEach(p => {
    inventoryMap[p.id] = {
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl || null,
      brandName: p.brand?.name || 'No Brand',
      isSerialized: false,
      quantity: netQuantities.get(p.id) || 0,
      serials: []
    };
  });

  return Object.values(inventoryMap);
}

// 6. Create multiple issue transactions atomically in a single batch
export async function createBulkIssueTransactions(payload) {
  await checkWriteAuth();

  const {
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    deliverySupervisorId,
    globalNotes = '',
    transactionDate, // Custom transaction date/time
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  if (items.length === 0) throw new Error('At least one product item is required for bulk issue');

  // 1. Batch Product Query
  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Validate all product existences and quantities
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty <= 0) throw new Error('Quantity must be a positive integer greater than 0');
    item.quantity = qty;
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  // 2. Batch Stock checks for bulk (non-serialized) items
  const bulkProductIds = items
    .filter(item => {
      const product = productsMap.get(item.productId);
      return product && !product.isSerialized;
    })
    .map(item => item.productId);

  const stockMap = (bulkProductIds.length > 0 && fromEntityType && fromEntityType !== 'SUPPLIER')
    ? await batchGetStock(bulkProductIds, fromEntityType, fromEntityId)
    : new Map();

  // Validate stocks in-memory
  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && !product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
      const currentStock = stockMap.get(item.productId) || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for product "${product.name}". Current stock at ${fromEntityType} is ${currentStock}, requested ${item.quantity}.`);
      }
    }
  }

  // 3. Batch Serial verification
  const allBarcodes = items.flatMap(item => item.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } },
      include: { product: { select: { name: true } } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  // Verify serial barcodes in-memory
  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && product.isSerialized && item.barcodes && item.barcodes.length > 0) {
      const foundSerials = item.barcodes.map(b => serialsMap.get(b)).filter(Boolean);
      const foundBarcodeStrings = foundSerials.map(s => s.barcode);
      const missingBarcodes = item.barcodes.filter(b => !foundBarcodeStrings.includes(b));
      if (missingBarcodes.length > 0) {
        throw new Error(`Some barcodes for product "${product.name}" could not be found in the database: ${missingBarcodes.join(', ')}`);
      }

      const mismatchedSerials = foundSerials.filter(s => s.productId !== item.productId);
      if (mismatchedSerials.length > 0) {
        const mismatches = mismatchedSerials.map(s => `"${s.barcode}" (belongs to product "${s.product.name}")`).join(', ');
        throw new Error(`Some barcodes belong to different products instead of "${product.name}": ${mismatches}`);
      }

      if (fromEntityType) {
        const invalidSerials = foundSerials.filter(
          (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
        );
        if (invalidSerials.length > 0) {
          throw new Error(`Some barcodes for "${product.name}" are not present at the source location (${fromEntityType}).`);
        }
      }
    }
  }

  // 4. Open transaction and write
  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    // Pre-fetch all existing promoter staff names in 1 query
    const existingStaffIds = items
      .map(i => i.promoterAssignment?.existingStaffId)
      .filter(Boolean);
    const staffNameMap = new Map();
    if (existingStaffIds.length > 0) {
      const staffList = await tx.staff.findMany({
        where: { id: { in: existingStaffIds } },
        select: { id: true, name: true }
      });
      staffList.forEach(s => staffNameMap.set(s.id, s.name));
    }

    // Pre-generate required IDs in batches
    const newPromoterCount = items.filter(i => i.promoterAssignment?.isNewPromoter).length;
    const newStaffIds = newPromoterCount > 0
      ? await generateBatchTxIds(tx, 'staff', 'STAF', newPromoterCount, 3)
      : [];
    let nextStaffIdx = 0;

    const allocationCount = items.filter(i => i.promoterAssignment?.storeId).length;
    const newAllocIds = allocationCount > 0
      ? await generateBatchTxIds(tx, 'staffUniformAllocation', 'ALOC', allocationCount, 5)
      : [];
    let nextAllocIdx = 0;

    const brandStoreConnections = new Set();

    // Group items by brand name
    const itemsByBrand = {};
    for (const item of items) {
      const product = productsMap.get(item.productId);
      const brandName = product?.brand?.name || 'General';
      if (!itemsByBrand[brandName]) {
        itemsByBrand[brandName] = [];
      }
      itemsByBrand[brandName].push(item);
    }

    for (const [brandName, brandItems] of Object.entries(itemsByBrand)) {
      const deliveryNote = await generateCustomRef(tx, 'DN', brandName, transactionDate);

      for (let idx = 0; idx < brandItems.length; idx++) {
        const item = brandItems[idx];
        const { productId, quantity, barcodes = [], notes, promoterAssignment } = item;
        const product = productsMap.get(productId);

        let finalToEntityType = toEntityType;
        let finalToEntityId = toEntityId;
        if (promoterAssignment && promoterAssignment.storeId) {
          finalToEntityType = 'STORE';
          finalToEntityId = promoterAssignment.storeId;
        }

        // Resolve receiver person from promoter assignment if present
        let receiverPerson = null;
        if (promoterAssignment) {
          if (promoterAssignment.isNewPromoter) {
            receiverPerson = promoterAssignment.promoterName?.trim() || null;
          } else if (promoterAssignment.existingStaffId) {
            receiverPerson = staffNameMap.get(promoterAssignment.existingStaffId) || null;
          }
        }

        // A. Create core transaction
        const invTx = await tx.inventoryTransaction.create({
          data: {
            productId,
            transactionType: 'ISSUE',
            fromEntityType,
            fromEntityId: fromEntityId || null,
            toEntityType: finalToEntityType,
            toEntityId: finalToEntityId || null,
            quantity,
            deliveryNote,
            receivedBy: receiverPerson || null,
            notes: (() => {
              const itemNote = notes?.trim() || '';
              const gNotes = (idx === 0 && globalNotes) ? globalNotes.trim() : '';
              if (gNotes && itemNote) {
                return `${gNotes} | ${itemNote}`;
              }
              return gNotes || itemNote || null;
            })(),
            deliveryStatus: 'Delivered',
            deliverySupervisorId: deliverySupervisorId || null,
            timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
            manufactureDate: item.manufactureDate ? parseTransactionDate(item.manufactureDate) : null,
            expiryDate: item.expiryDate ? parseTransactionDate(item.expiryDate) : null,
          },
        });

        if (finalToEntityType === 'STORE' && finalToEntityId && product?.brandId) {
          brandStoreConnections.add(`${product.brandId}:::${finalToEntityId}`);
        }

        // Handle promoter allocation if attached to item
        if (promoterAssignment) {
          const {
            isNewPromoter,
            promoterName,
            promoterPhone = '',
            promoterShirtSize = 'Medium',
            existingStaffId,
            storeId,
            allocatedItems = [],
            workingPeriod: rawWorkingPeriod = '',
            startDate,
            endDate,
            notes: promoterNotes = ''
          } = promoterAssignment;

          let workingPeriod = rawWorkingPeriod;
          if (!workingPeriod && startDate && endDate) {
            workingPeriod = `${startDate} to ${endDate}`;
          }

          let finalStaffId = existingStaffId;

          if (isNewPromoter) {
            if (!promoterName) throw new Error('Promoter name is required for registration');
            
            const staffIdVal = newStaffIds[nextStaffIdx++];

            const newStaff = await tx.staff.create({
              data: {
                id: staffIdVal,
                name: promoterName,
                phone: promoterPhone,
                shirtSize: promoterShirtSize,
                storeId: storeId || null,
              }
            });
            finalStaffId = newStaff.id;
          } else {
            if (!existingStaffId) throw new Error('Please select an existing promoter or register a new one');
            
            if (storeId) {
              await tx.staff.update({
                where: { id: existingStaffId },
                data: { storeId }
              });
            }
          }

          if (storeId) {
            const allocIdVal = newAllocIds[nextAllocIdx++];

            const isCap = (product.name || '').toLowerCase().includes('cap');
            const uniformCount = isCap ? 0 : quantity;
            const capCount = isCap ? quantity : 0;
            const dynamicItems = (allocatedItems && allocatedItems.length > 0)
              ? allocatedItems
              : [{
                  id: `item-${Date.now()}-${idx}`,
                  type: product.name,
                  size: product.size || promoterShirtSize || 'Medium',
                  qty: String(quantity || 1),
                  productId: product.id,
                  returned: false,
                  returnedAt: null
                }];

            await tx.staffUniformAllocation.create({
              data: {
                id: allocIdVal,
                staffId: finalStaffId,
                storeId,
                uniformQty: uniformCount,
                capQty: capCount,
                uniformReturned: false,
                capReturned: false,
                allocatedItems: dynamicItems,
                workingPeriod,
                supervisorId: deliverySupervisorId || null,
                givenDate: transactionDate ? parseTransactionDate(transactionDate) : new Date(),
                ref: deliveryNote,
                notes: promoterNotes || null,
              }
            });
          }
        }

        // B. Link serialized serials (with in-tx re-verification for concurrency safety)
        if (product.isSerialized && barcodes.length > 0) {
          // Re-fetch serials inside the transaction to catch any concurrent movements
          const itemSerials = await tx.productSerialNumber.findMany({
            where: { barcode: { in: barcodes }, productId }
          });
          const foundBarcodes = new Set(itemSerials.map(s => s.barcode));
          const missing = barcodes.filter(b => !foundBarcodes.has(b));
          if (missing.length > 0) {
            throw new Error(`Barcodes moved or missing (concurrent edit?): ${missing.join(', ')}`);
          }
          const invalidLocation = itemSerials.filter(
            s => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId
          );
          if (invalidLocation.length > 0) {
            throw new Error(`Some barcodes are no longer at the source location (concurrent edit?)`);
          }

          let nextStatus = 'AVAILABLE';
          if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

          // Bulk update location and status (1 write)
          await tx.productSerialNumber.updateMany({
            where: { id: { in: itemSerials.map(s => s.id) } },
            data: {
              currentLocationType: toEntityType || null,
              currentLocationId: toEntityId || null,
              status: nextStatus,
            }
          });

          // Bulk link serials to transaction (1 write)
          await tx.transactionSerialNumber.createMany({
            data: itemSerials.map(serial => ({
              transactionId: invTx.id,
              serialNumberId: serial.id,
            }))
          });
        }

        createdTxs.push(invTx);
      }
    }

    // Connect unique brand-store relationships in batch
    for (const pair of brandStoreConnections) {
      const [bId, sId] = pair.split(':::');
      await tx.brand.update({
        where: { id: bId },
        data: {
          stores: {
            connect: { id: sId }
          }
        }
      });
    }

    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths();

  const firstDn = transactions?.[0]?.deliveryNote || '';
  const totalQty = (items || []).reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0);
  safeNotifyTransaction({
    type: 'ISSUE',
    productName: `${items?.length || 1} product item${(items?.length || 1) > 1 ? 's' : ''}`,
    quantity: totalQty,
    deliveryNote: firstDn,
    destinationOrSource: toEntityType === 'STORE' ? 'Store Location' : toEntityType || 'Client',
  });

  return transactions;
}


export async function createBulkReceiveTransactions(formData) {
  await checkWriteAuth();

  const fromEntityType = formData.get('fromEntityType') || 'SUPPLIER';
  const fromEntityId = formData.get('fromEntityId') || 'Main Supplier';
  const toEntityType = formData.get('toEntityType') || 'WAREHOUSE';
  const toEntityId = formData.get('toEntityId') || null;
  const receivedBy = formData.get('receivedBy') || null;
  const globalNotes = formData.get('globalNotes') || '';
  const transactionDate = formData.get('transactionDate') || null;
  const itemsJson = formData.get('items');
  const items = JSON.parse(itemsJson || '[]');

  if (items.length === 0) throw new Error('At least one product item is required for bulk receive');

  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty <= 0) throw new Error('Quantity must be a positive integer greater than 0');
    item.quantity = qty;
  }

  // 1. Eagerly upload images outside database transaction lock
  const uploadedUrls = await Promise.all(
    items.map(async (item, idx) => {
      if (item.isNewProduct) {
        const imageFile = formData.get(`item_${idx}_imageFile`);
        if (imageFile && imageFile.size > 0) {
          const savedPath = await uploadToImageKit(imageFile);
          return { index: idx, url: savedPath };
        }
      }
      return { index: idx, url: null };
    })
  );
  const imageUrlsMap = new Map(uploadedUrls.map(u => [u.index, u.url]));

  // 2. Pre-generate IDs for new products count
  const newProductItems = items.filter(i => i.isNewProduct);

  // 3. Pre-validate existing products in one query
  const existingProductIds = items.filter(i => !i.isNewProduct).map(i => i.productId);
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: existingProductIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  const newBrandIds = [...new Set(newProductItems.map(i => i.prodBrandId).filter(Boolean))];
  const dbBrands = await prisma.brand.findMany({
    where: { id: { in: newBrandIds } },
    select: { id: true, name: true }
  });
  const brandsMap = new Map(dbBrands.map(b => [b.id, b.name]));

  const getItemBrandName = (item) => {
    if (item.isNewProduct) {
      return brandsMap.get(item.prodBrandId) || 'General';
    } else {
      const prod = productsMap.get(item.productId);
      return prod?.brand?.name || 'General';
    }
  };

  // Validate existence of existing products in-memory
  for (const item of items) {
    if (!item.isNewProduct) {
      const product = productsMap.get(item.productId);
      if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
    }
  }

  // 4. Pre-verify barcodes check for duplicates globally
  const allBarcodes = items.flatMap(i => i.barcodes || []);
  if (allBarcodes.length > 0) {
    const existingSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } },
      include: { product: { select: { name: true } } }
    });
    if (existingSerials.length > 0) {
      const dupes = existingSerials.map(s => `"${s.barcode}" (linked to product "${s.product.name}")`).join(', ');
      throw new Error(`Some barcodes already exist in the database: ${dupes}`);
    }
  }

  // 5. Open transaction and write data
  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    const newProductIds = newProductItems.length > 0
      ? await generateBatchTxIds(tx, 'product', 'PROD', newProductItems.length, 3)
      : [];
    let nextProductIdx = 0;

    // Group items by brand name
    const itemsByBrand = {};
    items.forEach((item, idx) => {
      const brandName = getItemBrandName(item);
      if (!itemsByBrand[brandName]) {
        itemsByBrand[brandName] = [];
      }
      itemsByBrand[brandName].push({ item, idx });
    });

    for (const [brandName, brandGroup] of Object.entries(itemsByBrand)) {
      const deliveryNote = await generateCustomRef(tx, 'REC', brandName, transactionDate);

      for (const { item, idx } of brandGroup) {
        let { productId, quantity, barcodes = [], notes, manufactureDate, expiryDate, isNewProduct } = item;
        let product;

        if (isNewProduct) {
          // Register the product inline!
          const { prodName, prodType, prodBrandId, prodCategory, prodSize, prodItemCode, prodLowStockAlert = '10', prodIsReturnable, prodIsDisposable, prodRack, prodShelf, prodTrackExpiry } = item;

          const bName = brandsMap.get(prodBrandId) || '';
          let formattedName = prodName.trim();
          if (bName) {
            const lowerName = formattedName.toLowerCase();
            const lowerBrand = bName.toLowerCase();
            if (!lowerName.startsWith(lowerBrand)) {
              formattedName = `${bName} - ${formattedName}`;
            }
          }

          const newProductId = newProductIds[nextProductIdx++];

          const imageUrl = imageUrlsMap.get(idx) || null;

          let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
          if (!itemCodeToSave) {
            itemCodeToSave = await generateSkuCode(tx, bName, prodCategory || 'General');
          }

          const isUniformCat = prodCategory && (prodCategory.toUpperCase() === 'UNIFORM' || prodCategory.toUpperCase() === 'UNIFORMS');
          const isSerialized = (prodType === 'SIM' || prodType === 'ROUTER' || item.isSerialized === true);
          product = await tx.product.create({
            data: {
              id: newProductId,
              name: formattedName,
              isSerialized,
              brandId: prodBrandId,
              category: isUniformCat ? 'UNIFORM' : (prodCategory || 'General'),
              size: prodSize || null,
              itemCode: itemCodeToSave,
              rack: prodRack || null,
              shelf: prodShelf || null,
              stockCap: prodLowStockAlert ? parseInt(prodLowStockAlert, 10) : null,
              isReturnable: isUniformCat ? true : !!prodIsReturnable,
              isDisposable: isUniformCat ? false : !!prodIsDisposable,
              trackExpiry: !!prodTrackExpiry,
              imageUrl,
            }
          });

          productId = product.id;
          if (product.isSerialized) {
            quantity = barcodes.length;
          }
        } else {
          product = productsMap.get(productId);
        }

        if (!productId) throw new Error('Product ID is required for all items');
        if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');

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
            deliveryNote,
            notes: (() => {
              const itemNote = notes?.trim() || '';
              const gNotes = (idx === 0 && globalNotes) ? globalNotes.trim() : '';
              if (gNotes && itemNote) {
                return `${gNotes} | ${itemNote}`;
              }
              return gNotes || itemNote || null;
            })(),
            manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            deliveryStatus: 'Delivered',
            receivedBy,
            timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
          },
        });

        // B. Create serials if serialized
        if (product.isSerialized && barcodes.length > 0) {
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
    }

    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths();

  const firstDn = transactions?.[0]?.deliveryNote || '';
  const totalQty = items.reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0);
  safeNotifyTransaction({
    type: 'RECEIVE',
    productName: `${items.length} product item${items.length > 1 ? 's' : ''}`,
    quantity: totalQty,
    deliveryNote: firstDn,
    destinationOrSource: fromEntityType === 'STORE' ? 'Store Return' : fromEntityId || 'Supplier',
  });

  return transactions;
}


export async function createBulkDamageTransactions(payload) {
  await checkWriteAuth();

  const {
    fromEntityType,
    fromEntityId,
    transactionType = 'DAMAGE', // 'DAMAGE' or 'LOST'
    items = [], // Array of { productId, quantity, barcodes, notes }
  } = payload;

  const resolvedType = transactionType === 'LOST' ? 'LOST' : 'DAMAGE';
  const serialStatus = resolvedType === 'LOST' ? 'LOST' : 'DAMAGED';

  if (items.length === 0) throw new Error('At least one product item is required for damage logging');

  // 1. Batch Product Query
  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Validate product existences in-memory
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  // 2. Batch Stock checks for bulk (non-serialized) items
  const bulkProductIds = items
    .filter(item => {
      const product = productsMap.get(item.productId);
      return product && !product.isSerialized;
    })
    .map(item => item.productId);

  const stockMap = (bulkProductIds.length > 0 && fromEntityType)
    ? await batchGetStock(bulkProductIds, fromEntityType, fromEntityId)
    : new Map();

  // Validate stock levels in-memory
  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && !product.isSerialized && fromEntityType) {
      const currentStock = stockMap.get(item.productId) || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for product "${product.name}". Current stock at ${fromEntityType} is ${currentStock}, requested ${item.quantity}.`);
      }
    }
  }

  // 3. Batch Serial verification
  const allBarcodes = items.flatMap(item => item.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } },
      include: { product: { select: { name: true } } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && product.isSerialized && item.barcodes && item.barcodes.length > 0) {
      const foundSerials = item.barcodes.map(b => serialsMap.get(b)).filter(Boolean);
      if (foundSerials.length !== item.barcodes.length) {
        throw new Error(`Some barcodes for product "${product.name}" could not be found in the database.`);
      }
      if (fromEntityType) {
        const invalidSerials = foundSerials.filter(
          s => s.currentLocationType !== fromEntityType || s.currentLocationId !== (fromEntityId || null)
        );
        if (invalidSerials.length > 0) {
          throw new Error(`Some barcodes for "${product.name}" are not present at the source location (${fromEntityType}).`);
        }
      }
    }
  }

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes } = item;
      const product = productsMap.get(productId);
      const brandName = product.brand?.name || 'General';
      const typeCode = resolvedType === 'LOST' ? 'LOS' : 'DAM';
      const deliveryNote = await generateCustomRef(tx, typeCode, brandName);

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
          notes: notes ? notes.trim() : null,
          deliveryStatus: 'Delivered',
          deliveryNote,
          manufactureDate: item.manufactureDate ? parseTransactionDate(item.manufactureDate) : null,
          expiryDate: item.expiryDate ? parseTransactionDate(item.expiryDate) : null,
        },
      });

      // B. Link serialized serials and mark as DAMAGED/LOST
      if (product.isSerialized && barcodes.length > 0) {
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const serialIds = itemSerials.map(s => s.id);

        // Bulk mark serial records as DAMAGED or LOST
        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            status: serialStatus,
            currentLocationType: null,
            currentLocationId: null,
          }
        });

        // Bulk insert the transaction-serial mappings
        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: invTx.id,
            serialNumberId,
          }))
        });
      }

      createdTxs.push(invTx);
    }

    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths();

  const totalQty = items.reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0);
  const firstItemProduct = items[0] ? productsMap.get(items[0].productId) : null;
  const brandName = firstItemProduct?.brand?.name || 'General';

  safeNotifyTransaction({
    type: resolvedType,
    productName: `${items.length} product item${items.length > 1 ? 's' : ''}`,
    quantity: totalQty,
    destinationOrSource: fromEntityType === 'WAREHOUSE' ? 'Warehouse' : fromEntityId || fromEntityType,
    brandName,
  });

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
  await checkWriteAuth();

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
    const prodIsDisposable = formData.get('prodIsDisposable') === 'true';

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
    const brandObj = await prisma.brand.findUnique({
      where: { id: prodBrandId },
      select: { name: true }
    });
    const bName = brandObj?.name || '';
    
    let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
    if (!itemCodeToSave) {
      itemCodeToSave = await generateSkuCode(prisma, bName, prodCategory || 'General');
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: sourceProductId },
      select: { isSerialized: true },
    });

    const newProduct = await prisma.product.create({
      data: {
        id: newProdId,
        name: prodName.trim(),
        brandId: prodBrandId,
        itemCode: itemCodeToSave,
        category: prodCategory,
        imageUrl: newImageUrl,
        isReturnable: prodIsReturnable,
        isDisposable: prodIsDisposable,
        isPublic: true,
        isSerialized: sourceProduct ? sourceProduct.isSerialized : true,
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

  const nonSerializedQty = parseFloat(formData.get('nonSerializedQty') || '0');
  const qty = barcodes.length > 0 ? barcodes.length : nonSerializedQty;
  const customDn = formData.get('deliveryNote') || undefined;
  const transactionDate = formData.get('transactionDate') || undefined;

  return processRebrand({
    oldProductId: sourceProductId,
    newProductId: finalTargetProductId,
    quantity: qty,
    notes: remarks,
    barcodes,
    deliveryNote: customDn,
    transactionDate,
  });
}

export async function updateBulkRebrandTransactions(deliveryNote, formData) {
  await checkWriteAuth();

  if (!deliveryNote) throw new Error('Delivery Note is required for update');

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { deliveryNote, transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] } },
        { id: deliveryNote, transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] } }
      ]
    },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing rebrand record not found');

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
    const prodIsDisposable = formData.get('prodIsDisposable') === 'true';

    const newProdId = await generateId('product', 'PROD', 3);

    const brandObj = await prisma.brand.findUnique({
      where: { id: prodBrandId },
      select: { name: true }
    });
    const bName = brandObj?.name || '';
    
    let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
    if (!itemCodeToSave) {
      itemCodeToSave = await generateSkuCode(prisma, bName, prodCategory || 'General');
    }

    const sourceProduct = await prisma.product.findUnique({
      where: { id: sourceProductId },
      select: { isSerialized: true },
    });

    const newProduct = await prisma.product.create({
      data: {
        id: newProdId,
        name: prodName.trim(),
        brandId: prodBrandId,
        itemCode: itemCodeToSave,
        category: prodCategory,
        imageUrl: newImageUrl,
        isReturnable: prodIsReturnable,
        isDisposable: prodIsDisposable,
        isPublic: true,
        isSerialized: sourceProduct ? sourceProduct.isSerialized : true,
        stockCap: parseInt(prodLowStockAlert, 10) || 10,
      }
    });

    finalTargetProductId = newProduct.id;
    revalidatePath('/dashboard/products');
  } else if (newImageUrl) {
    await prisma.product.update({
      where: { id: finalTargetProductId },
      data: { imageUrl: newImageUrl }
    });
    revalidatePath('/dashboard/products');
  }

  const barcodes = mappings.map(m => ({
    oldBarcode: m.sourceBarcode,
    newBarcode: m.targetBarcode,
    newSecondary: ''
  }));

  const nonSerializedQty = parseFloat(formData.get('nonSerializedQty') || '0');
  const qty = barcodes.length > 0 ? barcodes.length : nonSerializedQty;

  const [oldProduct, newProduct] = await Promise.all([
    prisma.product.findUnique({ 
      where: { id: sourceProductId },
      include: { brand: { select: { name: true } } }
    }),
    prisma.product.findUnique({ 
      where: { id: finalTargetProductId },
      include: { brand: { select: { name: true } } }
    }),
  ]);

  if (!oldProduct || !newProduct) throw new Error('Products not found');

  await prisma.$transaction(async (tx) => {
    const oldTxIds = oldTxs.map(t => t.id);
    
    const inTxIds = oldTxs.filter(t => t.transactionType === 'REBRAND_IN').map(t => t.id);
    const inSerials = await tx.transactionSerialNumber.findMany({
      where: { transactionId: { in: inTxIds } },
      select: { serialNumberId: true }
    });
    const createdSerialIds = inSerials.map(s => s.serialNumberId);

    if (createdSerialIds.length > 0) {
      await tx.productSerialNumber.deleteMany({
        where: { id: { in: createdSerialIds } }
      });
    }

    const outTxIds = oldTxs.filter(t => t.transactionType === 'REBRAND_OUT' || t.transactionType === 'REBRAND').map(t => t.id);
    const outSerials = await tx.transactionSerialNumber.findMany({
      where: { transactionId: { in: outTxIds } },
      select: { serialNumberId: true }
    });
    const oldSourceSerialIds = outSerials.map(s => s.serialNumberId);

    if (oldSourceSerialIds.length > 0) {
      await tx.productSerialNumber.updateMany({
        where: { id: { in: oldSourceSerialIds } },
        data: {
          status: 'AVAILABLE',
          currentLocationType: 'WAREHOUSE',
          currentLocationId: null,
        }
      });
    }

    await tx.inventoryTransaction.deleteMany({
      where: { id: { in: oldTxIds } }
    });

    const outTx = await tx.inventoryTransaction.create({
      data: {
        productId: sourceProductId,
        transactionType: 'REBRAND_OUT',
        fromEntityType: 'WAREHOUSE',
        quantity: qty,
        deliveryNote,
        notes: `Rebrand output -> ${newProduct.name}. ${remarks || ''}`,
      },
    });

    const inTx = await tx.inventoryTransaction.create({
      data: {
        productId: finalTargetProductId,
        transactionType: 'REBRAND_IN',
        toEntityType: 'WAREHOUSE',
        quantity: qty,
        deliveryNote,
        notes: `Rebrand input <- ${oldProduct.name}. ${remarks || ''}`,
      },
    });

    if (oldProduct.isSerialized && barcodes.length > 0) {
      const oldBarcodes = barcodes.map(b => b.oldBarcode);
      const sourceSerials = await tx.productSerialNumber.findMany({
        where: { barcode: { in: oldBarcodes } }
      });

      if (sourceSerials.length !== barcodes.length) {
        throw new Error('Some source barcodes could not be found.');
      }

      await tx.productSerialNumber.updateMany({
        where: { id: { in: sourceSerials.map(s => s.id) } },
        data: {
          status: 'REPLACED',
          currentLocationType: null,
          currentLocationId: null,
        }
      });

      await tx.transactionSerialNumber.createMany({
        data: sourceSerials.map(s => ({
          transactionId: outTx.id,
          serialNumberId: s.id,
        })),
        skipDuplicates: true
      });

      for (const item of barcodes) {
        const matchingOld = sourceSerials.find(s => s.barcode.toLowerCase() === item.oldBarcode.toLowerCase());
        const createdSerial = await tx.productSerialNumber.create({
          data: {
            productId: finalTargetProductId,
            barcode: item.newBarcode.trim(),
            secondaryBarcode: item.newSecondary ? item.newSecondary.trim() : null,
            currentLocationType: 'WAREHOUSE',
            status: 'AVAILABLE',
            replacesId: matchingOld ? matchingOld.id : null
          }
        });

        await tx.transactionSerialNumber.create({
          data: {
            transactionId: inTx.id,
            serialNumberId: createdSerial.id,
          }
        });
      }
    }
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/rebrand');
  return { success: true, deliveryNote };
}

export async function updateBulkDamageTransactions(deliveryNote, payload) {
  await checkWriteAuth();

  const {
    fromEntityType = 'WAREHOUSE',
    fromEntityId = null,
    transactionType = 'DAMAGE',
    transactionDate,
    items = [],
  } = payload;

  if (!deliveryNote) throw new Error('Delivery Note is required for update');
  if (items.length === 0) throw new Error('At least one product item is required for damage update');

  const resolvedType = transactionType === 'LOST' ? 'LOST' : 'DAMAGE';
  const serialStatus = resolvedType === 'LOST' ? 'LOST' : 'DAMAGED';

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { deliveryNote, transactionType: { in: ['DAMAGE', 'LOST'] } },
        { id: deliveryNote, transactionType: { in: ['DAMAGE', 'LOST'] } }
      ]
    },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing damage records not found');

  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  const allBarcodes = items.flatMap(item => item.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } },
      include: { product: { select: { name: true } } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  await prisma.$transaction(async (tx) => {
    // 1. Revert old serials to AVAILABLE in 1 batch
    const allOldSerialIds = oldTxs.flatMap(ot =>
      (ot.product?.isSerialized && ot.serialNumbers?.length > 0)
        ? ot.serialNumbers.map(s => s.serialNumber?.id).filter(Boolean)
        : []
    );

    if (allOldSerialIds.length > 0) {
      await tx.productSerialNumber.updateMany({
        where: { id: { in: allOldSerialIds } },
        data: {
          currentLocationType: fromEntityType || 'WAREHOUSE',
          currentLocationId: fromEntityId || null,
          status: 'AVAILABLE'
        }
      });
    }

    // Delete old transactions
    const oldTxIds = oldTxs.map(t => t.id);
    await tx.inventoryTransaction.deleteMany({
      where: { id: { in: oldTxIds } }
    });

    // 2. Create updated transactions
    const parsedDate = transactionDate ? parseTransactionDate(transactionDate) : undefined;
    for (const item of items) {
      const { productId, quantity, barcodes = [], notes, selectedBatches = [] } = item;
      const product = productsMap.get(productId);

      if (product.trackExpiry && !product.isSerialized && selectedBatches.length > 0) {
        for (const batch of selectedBatches) {
          if (!batch.quantity || batch.quantity <= 0) continue;
          await tx.inventoryTransaction.create({
            data: {
              productId,
              transactionType: resolvedType,
              fromEntityType,
              fromEntityId: fromEntityId || null,
              toEntityType: null,
              toEntityId: null,
              quantity: batch.quantity,
              notes: notes ? notes.trim() : null,
              deliveryNote,
              deliveryStatus: 'Delivered',
              manufactureDate: batch.manufactureDate ? new Date(batch.manufactureDate) : null,
              expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
              timestamp: parsedDate,
            }
          });
        }
        continue;
      }

      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: resolvedType,
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType: null,
          toEntityId: null,
          quantity,
          notes: notes ? notes.trim() : null,
          deliveryNote,
          deliveryStatus: 'Delivered',
          timestamp: parsedDate,
        }
      });

      if (product.isSerialized && barcodes.length > 0) {
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const serialIds = itemSerials.map(s => s.id);

        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            status: serialStatus,
            currentLocationType: fromEntityType,
            currentLocationId: fromEntityId || null
          }
        });

        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: invTx.id,
            serialNumberId,
          }))
        });
      }
    }
  }, { timeout: 25000 });

  revalidateTransactionPaths({ module: 'damage' });
  return { success: true, deliveryNote };
}

// Update only the notes and/or deliveryNote of an existing transaction
export async function updateTransactionNotes(id, { notes, deliveryNote }) {
  await checkWriteAuth();

  if (!id) throw new Error('Transaction ID is required');

  await prisma.inventoryTransaction.update({
    where: { id },
    data: {
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(deliveryNote !== undefined ? { deliveryNote: deliveryNote || null } : {}),
    },
  });

  revalidateTransactionPaths();

  return { success: true };
}

// Hard-delete a transaction — stock recalculates automatically from remaining rows
export async function deleteTransaction(id) {
  await requireAdmin();

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

  revalidateTransactionPaths();

  return { success: true };
}
// Full Edit for Transactions
export async function updateFullTransaction(id, payload) {
  await checkWriteAuth();

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

  revalidateTransactionPaths();
  revalidatePath('/dashboard/brands/[id]');
  revalidatePath('/portal/brand/[secretKey]');
  return { success: true };
}
// Create a single duplicate transaction
export async function createSingleTransaction(payload) {
  await checkWriteAuth();

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

  const parsedQty = parseInt(quantity, 10);
  if (!parsedQty || parsedQty <= 0) throw new Error('Quantity must be a positive integer greater than 0');

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

  revalidateTransactionPaths();
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

// Fetch all transactions associated with a Delivery Note and format them for copy / edit
export async function getTransactionsByDeliveryNote(deliveryNote) {
  await checkAuth();

  if (!deliveryNote) return [];

  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { deliveryNote },
        { id: deliveryNote }
      ]
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          isSerialized: true,
          trackExpiry: true,
          brandId: true,
          category: true,
          imageUrl: true,
          brand: { select: { id: true, name: true } }
        }
      },
      serialNumbers: {
        include: {
          serialNumber: {
            select: {
              id: true,
              barcode: true,
              status: true
            }
          }
        }
      }
    },
    orderBy: { timestamp: 'asc' }
  });

  return transactions.map((tx, idx) => {
    const barcodes = (tx.serialNumbers || []).map(s => s.serialNumber?.barcode).filter(Boolean);
    return {
      id: `temp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      rawTxId: tx.id,
      productId: tx.productId,
      quantity: tx.quantity,
      barcodesInput: '',
      barcodes,
      selectedBarcodes: barcodes,
      notes: tx.notes || '',
      isNewProduct: false,
      isExpanded: idx === 0,
      error: '',
      rangeStart: '',
      rangeEnd: '',
      rangeMode: false,
      manufactureDate: tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '',
      expiryDate: tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '',
      fromEntityType: tx.fromEntityType,
      fromEntityId: tx.fromEntityId,
      toEntityType: tx.toEntityType,
      toEntityId: tx.toEntityId,
      transactionType: tx.transactionType,
      deliverySupervisorId: tx.deliverySupervisorId || '',
      receivedBy: tx.receivedBy || '',
      deliveryNote: tx.deliveryNote,
      timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString() : null,
      serialNumbers: (tx.serialNumbers || []).map(s => ({
        id: s.id,
        serialNumber: s.serialNumber ? {
          id: s.serialNumber.id,
          barcode: s.serialNumber.barcode,
          status: s.serialNumber.status
        } : null
      })),
      product: tx.product,
      brandId: tx.product?.brandId || '',
      category: tx.product?.category || '',
      availableBarcodes: barcodes,
      availableBatches: [],
      selectedBatches: (tx.product?.trackExpiry && !tx.product?.isSerialized) ? [{
        manufactureDate: tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '',
        expiryDate: tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '',
        quantity: tx.quantity
      }] : [],
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
    };
  });
}

// Process Outbound Returns & Usage
export async function processOutboundReturns(returnsPayload) {
  await checkWriteAuth();

  if (!Array.isArray(returnsPayload) || returnsPayload.length === 0) {
    throw new Error('No items provided for processing');
  }

  // 1. Batch Fetch original transactions and products
  const txIds = returnsPayload.map(i => i.transactionId).filter(Boolean);
  const originalTxs = await prisma.inventoryTransaction.findMany({
    where: { id: { in: txIds } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          brand: { select: { name: true } }
        }
      }
    }
  });
  const origTxMap = new Map(originalTxs.map(t => [t.id, t]));

  // 2. Validate all payload items in memory
  for (const item of returnsPayload) {
    const { transactionId, actionType, qty } = item;
    if (!transactionId || !actionType) throw new Error('Missing required fields');

    const originalTx = origTxMap.get(transactionId);
    if (!originalTx) throw new Error(`Transaction not found: ${transactionId}`);
    if (originalTx.transactionType !== 'ISSUE') throw new Error(`Cannot process return for non-outbound transaction: ${transactionId}`);

    const processQty = parseInt(qty || '0', 10);
    const remainingQty = originalTx.quantity - (originalTx.returnedQty || 0);

    if (actionType === 'RETURN') {
      if (processQty <= 0) throw new Error('Return quantity must be greater than 0');
      if (processQty > remainingQty) throw new Error(`Cannot return ${processQty}. Only ${remainingQty} unreturned items remaining.`);
    } else if (actionType === 'USED') {
      if (remainingQty <= 0) throw new Error('No remaining quantity to mark as used');
      const useQty = (qty && parseInt(qty, 10) > 0) ? parseInt(qty, 10) : remainingQty;
      if (useQty <= 0) throw new Error('Used quantity must be greater than 0');
      if (useQty > remainingQty) throw new Error(`Cannot mark ${useQty} as used. Only ${remainingQty} items remaining.`);
    } else {
      throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of returnsPayload) {
      const { transactionId, actionType, qty, notes } = item;
      const originalTx = origTxMap.get(transactionId);
      const remainingQty = originalTx.quantity - (originalTx.returnedQty || 0);
      const brandName = originalTx.product?.brand?.name || 'General';

      if (actionType === 'RETURN') {
        const processQty = parseInt(qty || '0', 10);
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

        const deliveryNote = await generateCustomRef(tx, 'RET', brandName);

        // 2. Create RETURN transaction to return stock to Warehouse
        await tx.inventoryTransaction.create({
          data: {
            productId: originalTx.productId,
            transactionType: 'RETURN',
            fromEntityType: originalTx.toEntityType,
            fromEntityId: originalTx.toEntityId,
            toEntityType: 'WAREHOUSE',
            toEntityId: null,
            quantity: processQty,
            notes: `Auto-generated Return from Outbound ${transactionId}. ${notes || ''}`,
            deliveryStatus: 'Delivered',
            deliveryNote,
            deliverySupervisorId: originalTx.deliverySupervisorId || null,
            manufactureDate: originalTx.manufactureDate,
            expiryDate: originalTx.expiryDate,
          }
        });

        // 3. Keep any associated promoter uniform allocation in sync
        if (originalTx.deliveryNote) {
          const allocations = await tx.staffUniformAllocation.findMany({
            where: { ref: originalTx.deliveryNote }
          });
          for (const alloc of allocations) {
            let dynamicItems = [];
            if (alloc.allocatedItems) {
              if (typeof alloc.allocatedItems === 'string') {
                try { dynamicItems = JSON.parse(alloc.allocatedItems); } catch(e){}
              } else if (Array.isArray(alloc.allocatedItems)) {
                dynamicItems = alloc.allocatedItems;
              }
            }
            let itemMatched = false;
            const updatedItems = dynamicItems.map(item => {
              if (item.productId === originalTx.productId && !item.returned) {
                itemMatched = true;
                return { ...item, returned: true, returnedAt: new Date().toISOString() };
              }
              return item;
            });

            const isFullyReturned = newStatus === 'RETURNED';
            const updateData = {};
            if (itemMatched) {
              updateData.allocatedItems = updatedItems;
            }
            if (isFullyReturned) {
              updateData.uniformReturned = true;
              updateData.capReturned = true;
              updateData.returnDate = new Date();
            }
            if (Object.keys(updateData).length > 0) {
              await tx.staffUniformAllocation.update({
                where: { id: alloc.id },
                data: updateData
              });
            }
          }
        }

      } else if (actionType === 'USED') {
        const useQty = (qty && parseInt(qty, 10) > 0) ? parseInt(qty, 10) : remainingQty;
        const newReturnedQty = (originalTx.returnedQty || 0) + useQty;
        const newStatus = newReturnedQty >= originalTx.quantity ? 'USED' : 'PARTIAL';
        const newNotes = originalTx.returnNotes ? `${originalTx.returnNotes} | ${notes || 'Marked Used'}` : (notes || 'Marked Used');

        // 1. Update original Outbound transaction
        await tx.inventoryTransaction.update({
          where: { id: transactionId },
          data: {
            returnStatus: newStatus,
            returnNotes: newNotes,
            returnedQty: newReturnedQty,
          }
        });

        const deliveryNote = await generateCustomRef(tx, 'USD', brandName);

        // 2. Create USED transaction to move stock from Store to Staff (Used)
        await tx.inventoryTransaction.create({
          data: {
            productId: originalTx.productId,
            transactionType: 'ISSUE',
            fromEntityType: originalTx.toEntityType,
            fromEntityId: originalTx.toEntityId,
            toEntityType: 'STAFF',
            toEntityId: null,
            quantity: useQty,
            notes: `Marked as Used from Outbound ${transactionId}. ${notes || ''}`,
            deliveryStatus: 'Delivered',
            deliveryNote,
            manufactureDate: originalTx.manufactureDate,
            expiryDate: originalTx.expiryDate,
          }
        });

        // 3. Keep associated uniform allocation in sync
        if (originalTx.deliveryNote && newStatus === 'USED') {
          await tx.staffUniformAllocation.updateMany({
            where: { ref: originalTx.deliveryNote },
            data: {
              uniformReturned: true,
              capReturned: true,
              returnDate: new Date(),
            }
          });
        }
      }
    }
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'returns' });

  safeNotifyTransaction({
    type: 'RETURN',
    productName: `${returnsPayload.length} product item${returnsPayload.length > 1 ? 's' : ''}`,
    quantity: returnsPayload.reduce((acc, curr) => acc + parseInt(curr.qty || 0, 10), 0),
    destinationOrSource: 'Store Location',
  });

  return { success: true };
}

export async function updateBulkIssueTransactions(deliveryNote, payload) {
  await checkWriteAuth();

  const {
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    deliverySupervisorId,
    globalNotes = '',
    transactionDate,
    items = []
  } = payload;

  if (!deliveryNote) throw new Error('Delivery Note is required for update');
  if (items.length === 0) throw new Error('At least one product item is required for update');

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: { deliveryNote, transactionType: 'ISSUE' },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing delivery note not found or no issue transactions');

  // Eagerly load products for stock checking
  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Eager stock checking for new items
  const bulkProductIds = items
    .filter(item => {
      const product = productsMap.get(item.productId);
      return product && !product.isSerialized;
    })
    .map(item => item.productId);

  // Pre-fetch all new barcodes in 1 query
  const allNewBarcodes = items.flatMap(i => i.barcodes || []);

  const transactions = await prisma.$transaction(async (tx) => {
    // 1. REVERT OLD TRANSACTIONS IN 1 BATCH
    const oldTxIds = oldTxs.map(t => t.id);
    const allOldSerialIds = oldTxs.flatMap(ot =>
      (ot.product?.isSerialized && ot.serialNumbers?.length > 0)
        ? ot.serialNumbers.map(s => s.serialNumber?.id).filter(Boolean)
        : []
    );

    if (allOldSerialIds.length > 0) {
      await tx.productSerialNumber.updateMany({
        where: { id: { in: allOldSerialIds } },
        data: {
          currentLocationType: fromEntityType || 'WAREHOUSE',
          currentLocationId: fromEntityId || null,
          status: 'AVAILABLE'
        }
      });
    }

    await tx.inventoryTransaction.deleteMany({ where: { id: { in: oldTxIds } } });

    // 2. CHECK STOCK & PRE-FETCH BARCODES
    const stockMap = (bulkProductIds.length > 0 && fromEntityType && fromEntityType !== 'SUPPLIER')
      ? await batchGetStock(bulkProductIds, fromEntityType, fromEntityId)
      : new Map();

    let serialsMap = new Map();
    if (allNewBarcodes.length > 0) {
      const dbSerials = await tx.productSerialNumber.findMany({
        where: { barcode: { in: allNewBarcodes } }
      });
      serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
    }

    const createdTxs = [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const { productId, quantity, barcodes = [], notes } = item;
      const product = productsMap.get(productId);

      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      if (!product.isSerialized && fromEntityType && fromEntityType !== 'SUPPLIER') {
        const currentStock = stockMap.get(productId) || 0;
        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for product "${product.name}". Current stock at ${fromEntityType} is ${currentStock}, requested ${quantity}.`);
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
          notes: (() => {
            const itemNote = notes?.trim() || '';
            const gNotes = (idx === 0 && globalNotes) ? globalNotes.trim() : '';
            if (gNotes && itemNote) {
              return `${gNotes} | ${itemNote}`;
            }
            return gNotes || itemNote || null;
          })(),
          deliveryNote,
          deliverySupervisorId: deliverySupervisorId || null,
          deliveryStatus: 'Delivered',
          timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
        }
      });

      if (product.isSerialized && barcodes.length > 0) {
        if (barcodes.length !== quantity) {
          throw new Error(`Quantity (${quantity}) does not match scanned barcodes count (${barcodes.length}) for product "${product.name}"`);
        }
        
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const missing = barcodes.filter(b => !serialsMap.has(b));
        if (missing.length > 0) throw new Error(`Barcodes not found in database: ${missing.join(', ')}`);

        const invalidSerials = itemSerials.filter(s => s.productId !== productId || s.currentLocationType !== fromEntityType);
        if (invalidSerials.length > 0) throw new Error(`Some barcodes are not available at the source location for "${product.name}".`);

        let nextStatus = 'AVAILABLE';
        if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

        await tx.productSerialNumber.updateMany({
          where: { id: { in: itemSerials.map(s => s.id) } },
          data: {
            currentLocationType: toEntityType || null,
            currentLocationId: toEntityId || null,
            status: nextStatus
          }
        });

        await tx.transactionSerialNumber.createMany({
          data: itemSerials.map(serial => ({
            transactionId: invTx.id,
            serialNumberId: serial.id
          }))
        });
      }

      createdTxs.push(invTx);
    }
    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'outbound' });
  return transactions;
}

export async function updateBulkReceiveTransactions(deliveryNote, formData) {
  await checkWriteAuth();

  const fromEntityType = formData.get('fromEntityType') || 'SUPPLIER';
  const fromEntityId = formData.get('fromEntityId');
  const toEntityType = formData.get('toEntityType') || 'WAREHOUSE';
  const toEntityId = formData.get('toEntityId');
  const receivedBy = formData.get('receivedBy') || null;
  const globalNotes = formData.get('globalNotes') || '';
  const transactionDate = formData.get('transactionDate') || null;
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

  // Constraint: Check if any of these products have been dispatched outbound since this receipt (1 batch query)
  const issueConditions = oldTxs.map(t => ({
    productId: t.productId,
    transactionType: 'ISSUE',
    timestamp: { gt: t.timestamp }
  }));

  if (issueConditions.length > 0) {
    const issueExists = await prisma.inventoryTransaction.findFirst({
      where: { OR: issueConditions },
      include: { product: { select: { name: true } } }
    });
    if (issueExists) {
      throw new Error(`Cannot edit this Inbound receipt. Product "${issueExists.product?.name || 'Item'}" has already been dispatched outbound since this receipt.`);
    }
  }

  // 1. Pre-fetch existing products upfront in 1 query
  const existingProductIds = items.filter(i => !i.isNewProduct).map(i => i.productId);
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: existingProductIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  const allOldSerialIds = oldTxs.flatMap(ot =>
    (ot.product?.isSerialized && ot.serialNumbers?.length > 0)
      ? ot.serialNumbers.map(s => s.serialNumber?.id).filter(Boolean)
      : []
  );

  // 2. Pre-verify barcodes check for duplicates globally (excluding old serials being replaced)
  const allBarcodes = items.flatMap(i => i.barcodes || []);
  if (allBarcodes.length > 0) {
    const existingSerials = await prisma.productSerialNumber.findMany({
      where: {
        barcode: { in: allBarcodes },
        id: { notIn: allOldSerialIds }
      },
      include: { product: { select: { name: true } } }
    });
    if (existingSerials.length > 0) {
      const dupes = existingSerials.map(s => `"${s.barcode}" (linked to "${s.product.name}")`).join(', ');
      throw new Error(`Some barcodes already exist in the database: ${dupes}`);
    }
  }

  const transactions = await prisma.$transaction(async (tx) => {
    // 1. REVERT OLD TRANSACTIONS (batched deletes)
    if (allOldSerialIds.length > 0) {
      await tx.productSerialNumber.deleteMany({
        where: { id: { in: allOldSerialIds } }
      });
    }

    await tx.inventoryTransaction.deleteMany({
      where: { id: { in: oldTxs.map(ot => ot.id) } }
    });

    // 2. CREATE NEW TRANSACTIONS
    const createdTxs = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      let { isNewProduct, productId, quantity, barcodes = [], notes, manufactureDate, expiryDate } = item;

      if (isNewProduct) {
        const { prodName, prodType, prodBrandId, prodCategory, prodSize, prodItemCode, prodLowStockAlert, prodIsReturnable, prodIsDisposable, prodRack, prodShelf } = item;
        let imageUrl = null;
        const brand = await tx.brand.findUnique({
          where: { id: prodBrandId },
          select: { name: true }
        });
        const bName = brand?.name || '';
        
        let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
        if (!itemCodeToSave) {
          itemCodeToSave = await generateSkuCode(tx, bName, prodCategory || 'General');
        }

        const newProdId = await generateTxId(tx, 'product', 'PROD', 3);
        const isSerialized = (prodType === 'SIM' || prodType === 'ROUTER' || item.isSerialized === true);
        const newProduct = await tx.product.create({
          data: {
            id: newProdId,
            name: prodName,
            brandId: prodBrandId,
            category: prodCategory || null,
            size: prodSize || null,
            itemCode: itemCodeToSave,
            rack: prodRack || null,
            shelf: prodShelf || null,
            isSerialized,
            isReturnable: !!prodIsReturnable,
            isDisposable: !!prodIsDisposable,
            stockCap: prodLowStockAlert ? parseInt(prodLowStockAlert, 10) : null,
            imageUrl: imageUrl,
          }
        });
        productId = newProduct.id;
        productsMap.set(productId, newProduct);
      }

      const product = productsMap.get(productId);

      if (!product) {
        throw new Error(`Product not found for ID: ${productId}`);
      }

      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'RECEIVE',
          fromEntityType,
          fromEntityId: fromEntityId || null,
          toEntityType,
          toEntityId: toEntityId || null,
          quantity,
          deliveryNote,
          receivedBy,
          notes: (() => {
            const itemNote = notes?.trim() || '';
            const gNotes = (idx === 0 && globalNotes) ? globalNotes.trim() : '';
            if (gNotes && itemNote) {
              return `${gNotes} | ${itemNote}`;
            }
            return gNotes || itemNote || null;
          })(),
          deliveryStatus: 'Delivered',
          timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
          manufactureDate: manufactureDate ? parseTransactionDate(manufactureDate) : null,
          expiryDate: expiryDate ? parseTransactionDate(expiryDate) : null,
        }
      });

      if (product.isSerialized && barcodes.length > 0) {
        if (barcodes.length !== quantity) {
          throw new Error(`Quantity does not match barcodes count`);
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
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'inbound' });
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

export async function createBulkClientReturnTransactions(payload) {
  await checkWriteAuth();

  const {
    brandId,
    receivedBy,
    deliverySupervisorId,
    deliverySupervisorName,
    transactionDate,
    globalNotes,
    items = [], // Array of { productId, quantity, barcodes = [], notes }
  } = payload;

  if (!brandId) throw new Error('Client brand selection is required');
  if (items.length === 0) throw new Error('At least one item is required to log a return');

  let supervisorId = deliverySupervisorId || null;
  if (!supervisorId && deliverySupervisorName?.trim()) {
    const existing = await prisma.supervisor.findFirst({
      where: { name: { equals: deliverySupervisorName.trim(), mode: 'insensitive' } }
    });
    if (existing) {
      supervisorId = existing.id;
    } else {
      const created = await prisma.supervisor.create({
        data: { name: deliverySupervisorName.trim() }
      });
      supervisorId = created.id;
    }
  }

  // 1. Batch Product and Brand Query
  const productIds = [...new Set(items.map(i => i.productId))];
  const [brand, dbProducts] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: { select: { name: true } } }
    })
  ]);

  if (!brand) throw new Error('Brand not found');
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Validate all items in memory
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  // 2. Batch Serial query if serialized items exist
  const allBarcodes = items.flatMap(i => i.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && product.isSerialized && item.barcodes && item.barcodes.length > 0) {
      const foundSerials = item.barcodes.map(b => serialsMap.get(b)).filter(Boolean);
      if (foundSerials.length !== item.barcodes.length) {
        throw new Error(`Some barcodes for product "${product.name}" could not be found.`);
      }
      const invalidSerials = foundSerials.filter(
        s => s.currentLocationType !== 'WAREHOUSE' || s.currentLocationId !== 'MAIN'
      );
      if (invalidSerials.length > 0) {
        throw new Error(`Some barcodes for product "${product.name}" are not present in the Central Warehouse.`);
      }
    }
  }

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];
    const deliveryNote = await generateCustomRef(tx, 'CRN', brand.name, transactionDate);

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes, selectedBatches = [] } = item;
      const product = productsMap.get(productId);

      const baseNote = (() => {
        const itemNote = notes?.trim() || '';
        const gNotes = globalNotes?.trim() || '';
        if (gNotes && itemNote) return `${gNotes} | ${itemNote}`;
        return gNotes || itemNote || null;
      })();

      // For expiry-tracked products with batch selection, create one transaction per batch
      if (product.trackExpiry && !product.isSerialized && selectedBatches.length > 0) {
        for (const batch of selectedBatches) {
          if (!batch.quantity || batch.quantity <= 0) continue;
          await tx.inventoryTransaction.create({
            data: {
              productId,
              transactionType: 'CLIENT_RETURN',
              fromEntityType: 'WAREHOUSE',
              fromEntityId: 'MAIN',
              toEntityType: 'BRAND',
              toEntityId: brandId,
              quantity: batch.quantity,
              deliveryNote,
              notes: baseNote,
              receivedBy,
              deliverySupervisorId: supervisorId || null,
              deliveryStatus: 'Delivered',
              manufactureDate: batch.manufactureDate ? new Date(batch.manufactureDate) : null,
              expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
              timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
            }
          });
        }
        continue;
      }

      // Create transaction record
      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'CLIENT_RETURN',
          fromEntityType: 'WAREHOUSE',
          fromEntityId: 'MAIN',
          toEntityType: 'BRAND',
          toEntityId: brandId,
          quantity,
          deliveryNote,
          notes: baseNote,
          receivedBy,
          deliverySupervisorId: supervisorId || null,
          deliveryStatus: 'Delivered',
          timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
        }
      });

      // Update serials and create mapping records
      if (product.isSerialized && barcodes.length > 0) {
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const serialIds = itemSerials.map(s => s.id);

        // Bulk update status to WITH_CLIENT
        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            status: 'WITH_CLIENT',
            currentLocationType: 'BRAND',
            currentLocationId: brandId
          }
        });

        // Link to transaction
        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: invTx.id,
            serialNumberId,
          }))
        });
      }

      createdTxs.push(invTx);
    }
    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'client-returns' });
  return transactions;
}

export async function updateBulkClientReturnTransactions(deliveryNote, payload) {
  await checkWriteAuth();

  const {
    brandId,
    receivedBy,
    deliverySupervisorId,
    deliverySupervisorName,
    globalNotes,
    transactionDate,
    items = [],
  } = payload;

  if (!deliveryNote) throw new Error('Delivery Note is required for update');
  if (items.length === 0) throw new Error('At least one product item is required for client return update');

  let supervisorId = deliverySupervisorId || null;
  if (!supervisorId && deliverySupervisorName?.trim()) {
    const existing = await prisma.supervisor.findFirst({
      where: { name: { equals: deliverySupervisorName.trim(), mode: 'insensitive' } }
    });
    if (existing) {
      supervisorId = existing.id;
    } else {
      const created = await prisma.supervisor.create({
        data: { name: deliverySupervisorName.trim() }
      });
      supervisorId = created.id;
    }
  }

  const oldTxs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { deliveryNote, transactionType: 'CLIENT_RETURN' },
        { id: deliveryNote, transactionType: 'CLIENT_RETURN' }
      ]
    },
    include: {
      serialNumbers: { include: { serialNumber: true } },
      product: true
    }
  });

  if (oldTxs.length === 0) throw new Error('Existing client return records not found');

  const productIds = [...new Set(items.map(i => i.productId))];
  const [brand, dbProducts] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: { select: { name: true } } }
    })
  ]);

  if (!brand) throw new Error('Brand not found');
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  const allBarcodes = items.flatMap(i => i.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  await prisma.$transaction(async (tx) => {
    // 1. Revert old serials to AVAILABLE at WAREHOUSE
    for (const oldTx of oldTxs) {
      if (oldTx.product.isSerialized && oldTx.serialNumbers.length > 0) {
        const oldSerials = oldTx.serialNumbers.map(s => s.serialNumber);
        await tx.productSerialNumber.updateMany({
          where: { id: { in: oldSerials.map(s => s.id) } },
          data: {
            currentLocationType: 'WAREHOUSE',
            currentLocationId: 'MAIN',
            status: 'AVAILABLE'
          }
        });
      }
    }

    // Delete old transactions
    const oldTxIds = oldTxs.map(t => t.id);
    await tx.inventoryTransaction.deleteMany({
      where: { id: { in: oldTxIds } }
    });

    // 2. Create updated transactions
    const parsedDate = transactionDate ? parseTransactionDate(transactionDate) : undefined;
    for (const item of items) {
      const { productId, quantity, barcodes = [], notes, selectedBatches = [] } = item;
      const product = productsMap.get(productId);

      const baseNote = (() => {
        const itemNote = notes?.trim() || '';
        const gNotes = globalNotes?.trim() || '';
        if (gNotes && itemNote) return `${gNotes} | ${itemNote}`;
        return gNotes || itemNote || null;
      })();

      if (product.trackExpiry && !product.isSerialized && selectedBatches.length > 0) {
        for (const batch of selectedBatches) {
          if (!batch.quantity || batch.quantity <= 0) continue;
          await tx.inventoryTransaction.create({
            data: {
              productId,
              transactionType: 'CLIENT_RETURN',
              fromEntityType: 'WAREHOUSE',
              fromEntityId: 'MAIN',
              toEntityType: 'BRAND',
              toEntityId: brandId,
              quantity: batch.quantity,
              deliveryNote,
              notes: baseNote,
              receivedBy,
              deliverySupervisorId: supervisorId || null,
              deliveryStatus: 'Delivered',
              manufactureDate: batch.manufactureDate ? new Date(batch.manufactureDate) : null,
              expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
              timestamp: parsedDate,
            }
          });
        }
        continue;
      }

      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'CLIENT_RETURN',
          fromEntityType: 'WAREHOUSE',
          fromEntityId: 'MAIN',
          toEntityType: 'BRAND',
          toEntityId: brandId,
          quantity,
          deliveryNote,
          notes: baseNote,
          receivedBy,
          deliverySupervisorId: supervisorId || null,
          deliveryStatus: 'Delivered',
          timestamp: parsedDate,
        }
      });

      if (product.isSerialized && barcodes.length > 0) {
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const serialIds = itemSerials.map(s => s.id);

        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            status: 'WITH_CLIENT',
            currentLocationType: 'BRAND',
            currentLocationId: brandId
          }
        });

        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: invTx.id,
            serialNumberId,
          }))
        });
      }
    }
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/client-returns');
  return { success: true, deliveryNote };
}

export async function getClientReturnsBalances() {
  await checkAuth();

  const txs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { toEntityType: { in: ['BRAND', 'CLIENT'] } },
        { fromEntityType: { in: ['BRAND', 'CLIENT'] } },
        { transactionType: { in: ['CLIENT_STOCK', 'CLIENT_RETURN'] } }
      ]
    },
    select: {
      productId: true,
      transactionType: true,
      toEntityType: true,
      toEntityId: true,
      fromEntityType: true,
      fromEntityId: true,
      quantity: true,
      manufactureDate: true,
      expiryDate: true,
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          imageUrl: true,
          isSerialized: true,
          trackExpiry: true,
          brandId: true,
          brand: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  const balances = {};

  for (const tx of txs) {
    const isToClient = tx.transactionType === 'CLIENT_STOCK' || 
                       tx.toEntityType === 'BRAND' || 
                       tx.toEntityType === 'CLIENT' || 
                       (tx.transactionType === 'CLIENT_RETURN' && tx.toEntityType !== 'WAREHOUSE');
    
    const isReturnFromClient = (tx.transactionType === 'RETURN' && (tx.fromEntityType === 'CLIENT' || tx.fromEntityType === 'BRAND')) ||
                               (tx.transactionType === 'CLIENT_RETURN' && tx.toEntityType === 'WAREHOUSE');

    const brandId = (tx.toEntityType === 'BRAND' ? tx.toEntityId : (tx.fromEntityType === 'BRAND' ? tx.fromEntityId : tx.product.brandId)) || tx.product.brandId || 'BRND-SADIA';
    const brandName = tx.product.brand?.name || 'Sadia';
    const prodId = tx.productId;
    const key = `${brandId}_${prodId}`;

    if (!balances[key]) {
      balances[key] = {
        brandId,
        brandName,
        productId: prodId,
        productName: tx.product.name,
        imageUrl: tx.product.imageUrl || null,
        itemCode: tx.product.itemCode,
        category: tx.product.category,
        isSerialized: tx.product.isSerialized,
        trackExpiry: tx.product.trackExpiry || false,
        quantity: 0,
        serialNumbers: [],
        expiryBatches: []
      };
    }

    const qtyChange = isToClient ? tx.quantity : (isReturnFromClient ? -tx.quantity : 0);
    balances[key].quantity += qtyChange;

    // Track expiry batches for non-serialized expiry products
    if (balances[key].trackExpiry && !balances[key].isSerialized) {
      const mDateStr = tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '';
      const eDateStr = tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '';

      let batch = balances[key].expiryBatches.find(b => {
        const bM = b.manufactureDate ? new Date(b.manufactureDate).toISOString().split('T')[0] : '';
        const bE = b.expiryDate ? new Date(b.expiryDate).toISOString().split('T')[0] : '';
        return bM === mDateStr && bE === eDateStr;
      });

      if (!batch) {
        batch = { manufactureDate: tx.manufactureDate, expiryDate: tx.expiryDate, quantity: 0 };
        balances[key].expiryBatches.push(batch);
      }

      batch.quantity += qtyChange;
    }
  }

  // Pre-fetch all serials in ONE single batch query (eliminates N+1 loop)
  const activeSerializedBalances = Object.values(balances).filter(b => b.quantity > 0 && b.isSerialized);
  let serialsByBrandAndProduct = new Map();

  if (activeSerializedBalances.length > 0) {
    const prodIds = [...new Set(activeSerializedBalances.map(b => b.productId))];
    const brandIds = [...new Set(activeSerializedBalances.map(b => b.brandId))];

    const allSerials = await prisma.productSerialNumber.findMany({
      where: {
        productId: { in: prodIds },
        status: 'WITH_CLIENT',
        currentLocationType: 'BRAND',
        currentLocationId: { in: brandIds }
      },
      select: {
        id: true,
        productId: true,
        currentLocationId: true,
        barcode: true,
        manufactureDate: true,
        expiryDate: true
      }
    });

    allSerials.forEach(s => {
      const mapKey = `${s.currentLocationId}_${s.productId}`;
      if (!serialsByBrandAndProduct.has(mapKey)) {
        serialsByBrandAndProduct.set(mapKey, []);
      }
      serialsByBrandAndProduct.get(mapKey).push(s);
    });
  }

  const finalBalances = [];
  for (const key in balances) {
    const bal = balances[key];
    if (bal.quantity > 0) {
      if (bal.isSerialized) {
        const mapKey = `${bal.brandId}_${bal.productId}`;
        const serials = serialsByBrandAndProduct.get(mapKey) || [];
        bal.serialNumbers = serials;
        bal.quantity = serials.length;
      }

      // Filter out expired batches and negative-quantity batches for expiry products
      if (bal.trackExpiry && !bal.isSerialized) {
        const now = new Date();
        bal.expiryBatches = bal.expiryBatches.filter(b => b.quantity > 0);
        bal.quantity = bal.expiryBatches.reduce((sum, b) => sum + b.quantity, 0);
      }
      
      if (bal.quantity > 0) {
        finalBalances.push(bal);
      }
    }
  }

  return finalBalances;
}

// Return items from Client/Brand back to Warehouse
export async function returnClientItemsToWarehouse(payload) {
  await checkWriteAuth();

  const {
    brandId,
    receivedBy = '',
    deliverySupervisorName = '',
    transactionDate,
    globalNotes = '',
    items = [], // Array of { productId, quantity, barcodes = [], notes }
  } = payload;

  if (!brandId) throw new Error('Brand is required');
  if (items.length === 0) throw new Error('At least one item is required');

  // Use supervisor name as receivedBy if not explicitly provided
  const finalReceivedBy = receivedBy.trim() || deliverySupervisorName.trim() || 'System';

  // Resolve supervisor
  let supervisorId = null;
  if (deliverySupervisorName?.trim()) {
    const existing = await prisma.supervisor.findFirst({
      where: { name: { equals: deliverySupervisorName.trim(), mode: 'insensitive' } }
    });
    if (existing) {
      supervisorId = existing.id;
    } else {
      const created = await prisma.supervisor.create({
        data: { name: deliverySupervisorName.trim() }
      });
      supervisorId = created.id;
    }
  }

  // 1. Batch Product and Brand Query
  const productIds = [...new Set(items.map(i => i.productId))];
  const [brand, dbProducts] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: { select: { name: true } } }
    })
  ]);

  if (!brand) throw new Error('Brand not found');
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Validate all items in memory
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is required for all items');
    if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  // 2. Batch Stock checks for bulk items at client
  const bulkProductIds = items
    .filter(item => {
      const product = productsMap.get(item.productId);
      return product && !product.isSerialized;
    })
    .map(item => item.productId);

  const stockMap = bulkProductIds.length > 0
    ? await batchGetStock(bulkProductIds, 'BRAND', brandId)
    : new Map();

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && !product.isSerialized) {
      const currentStock = stockMap.get(item.productId) || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock with client for "${product.name}". Available: ${currentStock}, requested: ${item.quantity}.`);
      }
    }
  }

  // 3. Batch Serial verification
  const allBarcodes = items.flatMap(i => i.barcodes || []);
  let serialsMap = new Map();
  if (allBarcodes.length > 0) {
    const dbSerials = await prisma.productSerialNumber.findMany({
      where: { barcode: { in: allBarcodes } }
    });
    serialsMap = new Map(dbSerials.map(s => [s.barcode, s]));
  }

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (product && product.isSerialized && item.barcodes && item.barcodes.length > 0) {
      const foundSerials = item.barcodes.map(b => serialsMap.get(b)).filter(Boolean);
      if (foundSerials.length !== item.barcodes.length) {
        throw new Error(`Some barcodes for "${product.name}" could not be found.`);
      }
      const invalidSerials = foundSerials.filter(
        s => !(s.status === 'WITH_CLIENT' && s.currentLocationType === 'BRAND' && s.currentLocationId === brandId)
      );
      if (invalidSerials.length > 0) {
        throw new Error(`Some barcodes for "${product.name}" are not currently with this client.`);
      }
    }
  }

  const transactions = await prisma.$transaction(async (tx) => {
    const createdTxs = [];
    const deliveryNote = await generateCustomRef(tx, 'CRR', brand.name, transactionDate);

    for (const item of items) {
      const { productId, quantity, barcodes = [], notes, selectedBatches = [] } = item;
      const product = productsMap.get(productId);

      const baseNote = (() => {
        const itemNote = notes?.trim() || '';
        const gNotes = globalNotes?.trim() || '';
        if (gNotes && itemNote) return `Client→Warehouse Return | ${gNotes} | ${itemNote}`;
        if (gNotes) return `Client→Warehouse Return | ${gNotes}`;
        if (itemNote) return `Client→Warehouse Return | ${itemNote}`;
        return 'Client→Warehouse Return';
      })();

      // For expiry-tracked products, create one transaction per batch
      if (product.trackExpiry && !product.isSerialized && selectedBatches.length > 0) {
        for (const batch of selectedBatches) {
          if (!batch.quantity || batch.quantity <= 0) continue;
          await tx.inventoryTransaction.create({
            data: {
              productId,
              transactionType: 'CLIENT_RETURN',
              fromEntityType: 'BRAND',
              fromEntityId: brandId,
              toEntityType: 'WAREHOUSE',
              toEntityId: 'MAIN',
              quantity: batch.quantity,
              deliveryNote,
              notes: baseNote,
              receivedBy: finalReceivedBy,
              deliverySupervisorId: supervisorId || null,
              deliveryStatus: 'Delivered',
              manufactureDate: batch.manufactureDate ? new Date(batch.manufactureDate) : null,
              expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
              timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
            }
          });
        }
        continue;
      }

      // Create CLIENT_RETURN transaction (from BRAND → to WAREHOUSE)
      const invTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          transactionType: 'CLIENT_RETURN',
          fromEntityType: 'BRAND',
          fromEntityId: brandId,
          toEntityType: 'WAREHOUSE',
          toEntityId: 'MAIN',
          quantity,
          deliveryNote,
          notes: baseNote,
          receivedBy: finalReceivedBy,
          deliverySupervisorId: supervisorId || null,
          deliveryStatus: 'Delivered',
          timestamp: transactionDate ? parseTransactionDate(transactionDate) : undefined,
        }
      });

      // Handle serialized products
      if (product.isSerialized && barcodes.length > 0) {
        const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
        const serialIds = itemSerials.map(s => s.id);

        // Update serial status back to AVAILABLE at warehouse
        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            status: 'AVAILABLE',
            currentLocationType: 'WAREHOUSE',
            currentLocationId: 'MAIN',
          }
        });

        // Link serials to transaction
        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: invTx.id,
            serialNumberId,
          }))
        });
      }

      createdTxs.push({
        id: invTx.id,
        deliveryNote: invTx.deliveryNote,
        quantity: invTx.quantity,
        productId: invTx.productId,
      });
    }
    return createdTxs;
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'client-returns' });

  const totalQty = items.reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0);
  safeNotifyTransaction({
    type: 'CLIENT_RETURN',
    productName: `${items.length} product item${items.length > 1 ? 's' : ''}`,
    quantity: totalQty,
    brandName: brand?.name,
  });

  return transactions;
}

// Revert or Give Back Rebranded Items (vendor dispatch or warehouse product conversion)
export async function giveBackRebrandTransaction({
  transactionId,
  quantity,
  targetProductId,
  notes,
  barcodes = [],
}) {
  await checkWriteAuth();

  if (!transactionId) throw new Error('Transaction ID is required');

  const originalTx = await prisma.inventoryTransaction.findUnique({
    where: { id: transactionId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          isSerialized: true,
          brand: { select: { id: true, name: true } }
        }
      },
      serialNumbers: {
        include: { serialNumber: true }
      }
    }
  });

  if (!originalTx) throw new Error('Original rebranding transaction not found');

  const remainingQty = originalTx.quantity - (originalTx.returnedQty || 0);
  const returnQty = parseFloat(quantity || remainingQty);

  if (returnQty <= 0) {
    throw new Error('Give back quantity must be greater than 0');
  }
  if (returnQty > remainingQty + 0.0001) {
    throw new Error(`Cannot give back ${returnQty}. Only ${remainingQty} items remaining.`);
  }

  const brandName = originalTx.product?.brand?.name || 'General';

  const finalProductId = targetProductId || originalTx.productId;
  const targetProduct = await prisma.product.findUnique({
    where: { id: finalProductId },
    select: { id: true, name: true, isSerialized: true }
  });
  if (!targetProduct) throw new Error('Target product not found');

  await prisma.$transaction(async (tx) => {
    const newReturnedQty = (originalTx.returnedQty || 0) + returnQty;
    const newStatus = newReturnedQty >= originalTx.quantity - 0.0001 ? 'RETURNED' : 'PARTIAL';
    const combinedReturnNotes = originalTx.returnNotes
      ? `${originalTx.returnNotes} | ${notes || 'Returned to source'}`
      : (notes || 'Returned to source');

    // 1. Update original transaction with returned tracking
    await tx.inventoryTransaction.update({
      where: { id: transactionId },
      data: {
        returnedQty: newReturnedQty,
        returnStatus: newStatus,
        returnNotes: combinedReturnNotes,
      }
    });

    const returnDeliveryNote = await generateCustomRef(tx, 'RTR', brandName);

    const giveBackTx = await tx.inventoryTransaction.create({
      data: {
        productId: finalProductId,
        transactionType: 'REBRAND_IN',
        fromEntityType: originalTx.toEntityType || 'VENDOR',
        fromEntityId: originalTx.toEntityId || null,
        toEntityType: 'WAREHOUSE',
        toEntityId: 'WH-MAIN',
        quantity: returnQty,
        deliveryNote: returnDeliveryNote,
        notes: `Returned to source from ${originalTx.deliveryNote || originalTx.id}. ${notes || ''}`.trim(),
        deliveryStatus: 'Delivered',
      }
    });

    // 3. Handle Serialized Products if any
    if (originalTx.product.isSerialized) {
      // Find serials to return
      let serialsToReturn = [];
      if (barcodes.length > 0) {
        serialsToReturn = await tx.productSerialNumber.findMany({
          where: { barcode: { in: barcodes } }
        });
      } else if (originalTx.serialNumbers.length > 0) {
        // Take up to returnQty serials from original transaction
        serialsToReturn = originalTx.serialNumbers
          .map(s => s.serialNumber)
          .slice(0, Math.round(returnQty));
      }

      if (serialsToReturn.length > 0) {
        const serialIds = serialsToReturn.map(s => s.id);

        // Update serials to be available in warehouse under target product
        await tx.productSerialNumber.updateMany({
          where: { id: { in: serialIds } },
          data: {
            productId: finalProductId,
            status: 'AVAILABLE',
            currentLocationType: 'WAREHOUSE',
            currentLocationId: 'WH-MAIN',
          }
        });

        // Link serials to the return transaction
        await tx.transactionSerialNumber.createMany({
          data: serialIds.map(serialNumberId => ({
            transactionId: giveBackTx.id,
            serialNumberId,
          }))
        });
      }
    }
  }, { timeout: 20000 });

  revalidateTransactionPaths({ module: 'rebrand' });

  return { success: true };
}

// Revert a completed Rebrand transaction back to its original (old) product definition
export async function revertRebrandTransaction({
  transactionId,
  quantity,
  notes,
}) {
  await checkWriteAuth();

  if (!transactionId) throw new Error('Transaction ID is required');

  const originalTx = await prisma.inventoryTransaction.findUnique({
    where: { id: transactionId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          isSerialized: true,
          brand: { select: { id: true, name: true } }
        }
      },
      serialNumbers: {
        include: {
          serialNumber: {
            include: {
              replaces: { include: { product: true } },
              replacedBy: { include: { product: true } }
            }
          }
        }
      }
    }
  });

  if (!originalTx) throw new Error('Original rebranding transaction not found');

  // Identify paired transactions or source / target products
  const dn = originalTx.deliveryNote;
  let pairedTxs = [];
  if (dn) {
    pairedTxs = await prisma.inventoryTransaction.findMany({
      where: {
        deliveryNote: dn,
        transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] }
      },
      include: {
        product: { select: { id: true, name: true, isSerialized: true, brand: { select: { name: true } } } },
        serialNumbers: { include: { serialNumber: true } }
      }
    });
  } else {
    pairedTxs = [originalTx];
  }

  let sourceProduct = null; // The old product to be restored
  let targetProduct = null; // The converted product holding the stock
  const outTx = pairedTxs.find(t => t.transactionType === 'REBRAND_OUT' || t.transactionType === 'REBRAND');
  const inTx = pairedTxs.find(t => t.transactionType === 'REBRAND_IN');

  if (outTx && inTx) {
    sourceProduct = outTx.product;
    targetProduct = inTx.product;
  } else if (originalTx.transactionType === 'REBRAND_IN') {
    targetProduct = originalTx.product;
    if (originalTx.serialNumbers?.length > 0) {
      const srcProd = originalTx.serialNumbers.find(s => s.serialNumber?.replaces?.product)?.serialNumber?.replaces?.product;
      if (srcProd) sourceProduct = srcProd;
    }
    if (!sourceProduct && originalTx.notes) {
      const match = originalTx.notes.match(/Rebrand input <-\s*([^.]+)/i);
      if (match) {
        const found = await prisma.product.findFirst({ where: { name: match[1].trim() } });
        if (found) sourceProduct = found;
      }
    }
  } else if (originalTx.transactionType === 'REBRAND_OUT' || originalTx.transactionType === 'REBRAND') {
    sourceProduct = originalTx.product;
    if (originalTx.serialNumbers?.length > 0) {
      const tgtProd = originalTx.serialNumbers.find(s => s.serialNumber?.replacedBy?.product)?.serialNumber?.replacedBy?.product;
      if (tgtProd) targetProduct = tgtProd;
    }
    if (!targetProduct && originalTx.notes) {
      const match = originalTx.notes.match(/Rebrand output ->\s*([^.]+)/i);
      if (match) {
        const found = await prisma.product.findFirst({ where: { name: match[1].trim() } });
        if (found) targetProduct = found;
      }
    }
  }

  if (!sourceProduct) {
    throw new Error('Could not automatically determine original source product to restore. Please use Give Back to choose the return product.');
  }

  const revertQty = parseFloat(quantity || (inTx ? inTx.quantity : originalTx.quantity));
  if (!revertQty || revertQty <= 0) {
    throw new Error('Revert quantity must be greater than 0');
  }

  // If targetProduct is known and not serialized, verify warehouse stock
  if (targetProduct && !targetProduct.isSerialized) {
    const currentTargetStock = await getStockAtLocation(targetProduct.id, 'WAREHOUSE', null);
    if (currentTargetStock < revertQty) {
      throw new Error(`Insufficient warehouse stock for converted product "${targetProduct.name}". Current stock is ${currentTargetStock}, requested to revert ${revertQty}.`);
    }
  }

  const brandName = sourceProduct.brand?.name || targetProduct?.brand?.name || 'General';

  await prisma.$transaction(async (tx) => {
    const revertDn = await generateCustomRef(tx, 'REV', brandName);
    const userNotes = notes ? ` (${notes.trim()})` : '';

    // 1. If targetProduct exists, deduct from target product in Warehouse
    if (targetProduct) {
      await tx.inventoryTransaction.create({
        data: {
          productId: targetProduct.id,
          transactionType: 'REBRAND_OUT',
          fromEntityType: 'WAREHOUSE',
          quantity: revertQty,
          deliveryNote: revertDn,
          notes: `Reverted rebrand -> Restored ${revertQty} units back to ${sourceProduct.name} from ${dn || originalTx.id}.${userNotes}`,
          deliveryStatus: 'Delivered',
          returnStatus: 'REVERTED',
          returnedQty: revertQty,
        }
      });
    }

    // 2. Add back to original source product in Warehouse
    const restoreInTx = await tx.inventoryTransaction.create({
      data: {
        productId: sourceProduct.id,
        transactionType: 'REBRAND_IN',
        toEntityType: 'WAREHOUSE',
        toEntityId: 'WH-MAIN',
        quantity: revertQty,
        deliveryNote: revertDn,
        notes: `Reverted rebrand <- Restored ${revertQty} units from ${targetProduct?.name || 'converted product'} (${dn || originalTx.id}).${userNotes}`,
        deliveryStatus: 'Delivered',
        returnStatus: 'REVERTED',
        returnedQty: revertQty,
      }
    });

    // 3. Serialized items handling
    if (sourceProduct.isSerialized && inTx?.serialNumbers?.length > 0) {
      const inSerialIds = inTx.serialNumbers.map(s => s.serialNumberId);
      const inSerials = await tx.productSerialNumber.findMany({
        where: { id: { in: inSerialIds } },
        include: { replaces: true }
      });

      // Restore replaced original serials back to AVAILABLE at WAREHOUSE
      const oldSerialIdsToRestore = inSerials.map(s => s.replacesId).filter(Boolean);
      if (oldSerialIdsToRestore.length > 0) {
        await tx.productSerialNumber.updateMany({
          where: { id: { in: oldSerialIdsToRestore } },
          data: {
            status: 'AVAILABLE',
            currentLocationType: 'WAREHOUSE',
            currentLocationId: 'WH-MAIN',
          }
        });

        // Link restored serials to restoreInTx
        await tx.transactionSerialNumber.createMany({
          data: oldSerialIdsToRestore.map(sId => ({
            transactionId: restoreInTx.id,
            serialNumberId: sId,
          })),
          skipDuplicates: true
        });
      }

      // Mark the converted serials as REPLACED / DELETED
      await tx.productSerialNumber.updateMany({
        where: { id: { in: inSerialIds } },
        data: {
          status: 'REPLACED',
          currentLocationType: null,
          currentLocationId: null,
        }
      });
    }

    // 4. Update status on original transactions
    await tx.inventoryTransaction.updateMany({
      where: { id: { in: pairedTxs.map(t => t.id) } },
      data: {
        returnStatus: 'REVERTED',
        returnNotes: `Reverted under ${revertDn}.${userNotes}`,
      }
    });
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/rebrand');

  return { success: true };
}

// ----------------------------------------------------------------------------------------
// MULTI-ITEM REBRANDING SYSTEM (Send Multiple Source Products -> Receive Multiple Target Products)
// ----------------------------------------------------------------------------------------

/**
 * Send multiple source products to vendor for rebranding
 * Logs REBRAND_OUT from WAREHOUSE to VENDOR with returnStatus = 'PENDING'
 */
export async function createMultiRebrandOutbound(payload) {
  await checkWriteAuth();

  const {
    vendorName = 'Advamedia',
    transactionDate,
    globalNotes = '',
    deliveryNote: customDn,
    items = [], // Array of { productId, quantity, barcodes = [], notes = '' }
  } = payload;

  if (!items || items.length === 0) throw new Error('At least one source product is required');

  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  // Validate items & stock
  const unSerializedIds = items.filter(i => {
    const prod = productsMap.get(i.productId);
    return prod && !prod.isSerialized;
  }).map(i => i.productId);

  const stockMap = unSerializedIds.length > 0
    ? await batchGetStock(unSerializedIds, 'WAREHOUSE', null)
    : new Map();

  for (const item of items) {
    if (!item.productId) throw new Error('Product selection is required for all items');
    const qty = parseFloat(item.quantity);
    if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
    
    const prod = productsMap.get(item.productId);
    if (!prod) throw new Error(`Product not found: ${item.productId}`);

    if (!prod.isSerialized) {
      const stock = stockMap.get(item.productId) || 0;
      if (stock < qty) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${stock}, Requested: ${qty}`);
      }
    }
  }

  const primaryBrand = dbProducts[0]?.brand?.name || 'General';

  const result = await prisma.$transaction(async (tx) => {
    const deliveryNote = customDn || await generateCustomRef(tx, 'RBD', primaryBrand, transactionDate);
    const parsedDate = transactionDate ? parseTransactionDate(transactionDate) : undefined;
    const createdTxs = [];

    for (const item of items) {
      const prod = productsMap.get(item.productId);
      const qty = parseFloat(item.quantity);
      const itemNote = item.notes?.trim() || '';
      const combinedNote = globalNotes ? `${globalNotes} | ${itemNote}`.trim() : itemNote;

      const outTx = await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'REBRAND_OUT',
          fromEntityType: 'WAREHOUSE',
          fromEntityId: 'MAIN',
          toEntityType: 'VENDOR',
          toEntityId: vendorName.trim() || 'Advamedia',
          quantity: qty,
          deliveryNote,
          notes: combinedNote || `Sent to ${vendorName || 'Vendor'} for rebranding.`,
          returnStatus: 'PENDING',
          returnedQty: 0,
          timestamp: parsedDate,
        }
      });

      // Handle serialized items
      if (prod.isSerialized && item.barcodes && item.barcodes.length > 0) {
        const serials = await tx.productSerialNumber.findMany({
          where: { barcode: { in: item.barcodes } }
        });

        if (serials.length !== item.barcodes.length) {
          throw new Error(`Some barcodes for "${prod.name}" were not found in database.`);
        }

        await tx.productSerialNumber.updateMany({
          where: { id: { in: serials.map(s => s.id) } },
          data: {
            status: 'OUT_FOR_REBRAND',
            currentLocationType: 'VENDOR',
            currentLocationId: vendorName.trim() || 'Advamedia'
          }
        });

        await tx.transactionSerialNumber.createMany({
          data: serials.map(s => ({
            transactionId: outTx.id,
            serialNumberId: s.id,
          }))
        });
      }

      createdTxs.push(outTx);
    }

    return { deliveryNote, transactions: createdTxs };
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/rebrand');
  return result;
}

/**
 * Receive converted rebranded stock from vendor back into warehouse
 * Matches or completes pending outbound rebrands under a delivery note
 */
export async function receiveRebrandItems(payload) {
  await checkWriteAuth();

  const {
    deliveryNote,
    transactionId, // optional specific parent tx
    vendorName = 'Advamedia',
    transactionDate,
    globalNotes = '',
    receivedItems = [], // Array of { targetProductId, quantity, barcodes = [], notes = '' }
  } = payload;

  if (!receivedItems || receivedItems.length === 0) {
    throw new Error('At least one received target product is required');
  }

  // Find parent outbound transactions under this delivery note or transactionId
  const parentTxs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        deliveryNote ? { deliveryNote, transactionType: { in: ['REBRAND', 'REBRAND_OUT'] } } : null,
        transactionId ? { id: transactionId } : null,
      ].filter(Boolean)
    },
    include: {
      product: { select: { id: true, name: true, brand: { select: { name: true } } } }
    }
  });

  if (parentTxs.length === 0) {
    throw new Error('No matching outbound rebrand records found for this delivery note');
  }

  // Compute remaining pending qty on parent transactions
  const totalSent = parentTxs.reduce((sum, tx) => sum + tx.quantity, 0);
  const totalAlreadyReturned = parentTxs.reduce((sum, tx) => sum + (tx.returnedQty || 0), 0);
  const totalRemainingPending = Math.max(0, totalSent - totalAlreadyReturned);

  const totalReceivingNow = receivedItems.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);

  const primaryBrand = parentTxs[0]?.product?.brand?.name || 'General';

  const result = await prisma.$transaction(async (tx) => {
    const parsedDate = transactionDate ? parseTransactionDate(transactionDate) : undefined;
    const finalDn = deliveryNote || parentTxs[0]?.deliveryNote || await generateCustomRef(tx, 'REC-RBD', primaryBrand, transactionDate);

    // 1. Log inbound REBRAND_IN for each received target product
    const createdInTxs = [];
    for (const item of receivedItems) {
      const targetProd = await tx.product.findUnique({
        where: { id: item.targetProductId },
        include: { brand: { select: { name: true } } }
      });
      if (!targetProd) throw new Error(`Target product not found: ${item.targetProductId}`);

      const qty = parseFloat(item.quantity);
      if (!qty || qty <= 0) throw new Error('Received quantity must be greater than 0');

      const itemNote = item.notes?.trim() || '';
      const combinedNote = globalNotes ? `${globalNotes} | ${itemNote}`.trim() : itemNote;

      const inTx = await tx.inventoryTransaction.create({
        data: {
          productId: targetProd.id,
          transactionType: 'REBRAND_IN',
          fromEntityType: 'VENDOR',
          fromEntityId: vendorName.trim() || 'Advamedia',
          toEntityType: 'WAREHOUSE',
          toEntityId: 'WH-MAIN',
          quantity: qty,
          deliveryNote: finalDn,
          notes: combinedNote || `Received converted rebrand (${finalDn}) from ${vendorName || 'Advamedia'}.`,
          deliveryStatus: 'Delivered',
          timestamp: parsedDate,
        }
      });

      // Handle Serialized Items if target is serialized
      if (targetProd.isSerialized && item.barcodes && item.barcodes.length > 0) {
        const rawBarcodes = item.barcodes
          .map(bc => (typeof bc === 'string' ? bc : bc.barcode)?.trim())
          .filter(Boolean);

        if (rawBarcodes.length > 0) {
          const existingSerials = await tx.productSerialNumber.findMany({
            where: { barcode: { in: rawBarcodes } },
            select: { id: true, barcode: true }
          });
          const existingBarcodeSet = new Set(existingSerials.map(s => s.barcode));

          // 1. Bulk update existing serials
          if (existingSerials.length > 0) {
            await tx.productSerialNumber.updateMany({
              where: { id: { in: existingSerials.map(s => s.id) } },
              data: {
                productId: targetProd.id,
                status: 'AVAILABLE',
                currentLocationType: 'WAREHOUSE',
                currentLocationId: 'WH-MAIN',
              }
            });
          }

          // 2. Bulk insert new serials
          const newBarcodes = rawBarcodes.filter(b => !existingBarcodeSet.has(b));
          if (newBarcodes.length > 0) {
            await tx.productSerialNumber.createMany({
              data: newBarcodes.map(barcode => ({
                productId: targetProd.id,
                barcode,
                status: 'AVAILABLE',
                currentLocationType: 'WAREHOUSE',
                currentLocationId: 'WH-MAIN',
              })),
              skipDuplicates: true
            });
          }
        }
      }

      createdInTxs.push(inTx);
    }

    // 2. Distribute returnedQty across parent transactions to update their status
    let remainingToDistribute = totalReceivingNow;
    for (const parent of parentTxs) {
      const parentRemaining = Math.max(0, parent.quantity - (parent.returnedQty || 0));
      if (parentRemaining <= 0) continue;

      const alloc = Math.min(parentRemaining, remainingToDistribute);
      const newReturnedQty = (parent.returnedQty || 0) + alloc;
      const newStatus = newReturnedQty >= parent.quantity - 0.0001 ? 'COMPLETED' : 'PARTIAL';

      await tx.inventoryTransaction.update({
        where: { id: parent.id },
        data: {
          returnedQty: newReturnedQty,
          returnStatus: newStatus,
          returnNotes: parent.returnNotes ? `${parent.returnNotes} | Received ${alloc}` : `Received ${alloc}`,
        }
      });

      remainingToDistribute -= alloc;
      if (remainingToDistribute <= 0) break;
    }

    return { deliveryNote: finalDn, receivedCount: createdInTxs.length };
  }, { timeout: 25000 });

  revalidateTransactionPaths();
  revalidatePath('/dashboard/rebrand');
  return result;
}


