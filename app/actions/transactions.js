'use server';

import { prisma } from '@/lib/prisma';
import { generateId } from '@/lib/idGenerator';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function generateSkuCode(tx, brandName, categoryName) {
  const brandPrefix = (brandName || 'GEN').substring(0, 3).toUpperCase();
  const catPrefix = (categoryName || 'GEN').substring(0, 3).toUpperCase();
  const prefix = `${brandPrefix}-${catPrefix}`;
  
  if (!tx.prefixCache) tx.prefixCache = {};
  if (tx.prefixCache[prefix] === undefined) {
    const existing = await tx.product.findMany({
      where: { itemCode: { startsWith: `${prefix}-` } },
      select: { itemCode: true }
    });
    let max = 0;
    for (const p of existing) {
      if (p.itemCode) {
        const match = p.itemCode.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
    }
    tx.prefixCache[prefix] = max;
  }
  tx.prefixCache[prefix]++;
  return `${prefix}-${String(tx.prefixCache[prefix]).padStart(4, '0')}`;
}
import { uploadToImageKit } from '@/lib/imagekit';

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
}

// Helper function - non-async utility
function parseTransactionDate(dateStr) {
  if (!dateStr) return undefined;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  
  if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
    // UAE time is UTC+4
    const hasSeconds = (dateStr.match(/:/g) || []).length > 1;
    return new Date(dateStr + (hasSeconds ? '' : ':00') + '+04:00');
  }
  
  if (dateStr.includes('T') || dateStr.includes(':')) {
    return new Date(dateStr);
  }
  
  return new Date(dateStr + 'T12:00:00+04:00');
}

export async function generateCustomRef(tx, type, brandName, customDate = null) {
  const cleanBrand = brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'GEN';
  const typeCode = type.toUpperCase();
  
  const dateObj = customDate ? new Date(customDate) : new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;

  // Format: TYPE-BRD-DDMMYY-NNN  e.g. REC-SAD-200826-001
  const prefix = `${typeCode}-${cleanBrand}-${dateStr}-`;
  
  const existing = await tx.inventoryTransaction.findMany({
    where: {
      deliveryNote: { startsWith: prefix }
    },
    select: { deliveryNote: true },
    distinct: ['deliveryNote']
  });

  const nextNum = existing.length + 1;
  const suffix = String(nextNum).padStart(3, '0');
  return `${prefix}${suffix}`;
}

// 1. Calculate stock at a specific location for bulk products
export async function getStockAtLocation(productId, entityType, entityId) {
  await checkAuth();

  // Inbound stock
  const inbound = await prisma.inventoryTransaction.aggregate({
    where: {
      productId,
      toEntityType: entityType,
      ...(entityType === 'WAREHOUSE' ? {} : { toEntityId: entityId || null }),
    },
    _sum: { quantity: true },
  });

  // Outbound stock
  const outbound = await prisma.inventoryTransaction.aggregate({
    where: {
      productId,
      fromEntityType: entityType,
      ...(entityType === 'WAREHOUSE' ? {} : { fromEntityId: entityId || null }),
    },
    _sum: { quantity: true },
  });

  const inQty = inbound._sum.quantity || 0;
  const outQty = outbound._sum.quantity || 0;

  return inQty - outQty;
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
  }, { timeout: 20000 });

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
    barcodes = [],
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
  }, { timeout: 20000 });

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
            itemCode: true,
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
  await checkAuth();

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

  // Validate all product existences
  for (const item of items) {
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

  const stockMap = new Map();
  if (bulkProductIds.length > 0 && fromEntityType && fromEntityType !== 'SUPPLIER') {
    const [inboundSums, outboundSums] = await Promise.all([
      prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: {
          productId: { in: bulkProductIds },
          toEntityType: fromEntityType,
          ...(fromEntityType === 'WAREHOUSE' ? {} : { toEntityId: fromEntityId || null }),
        },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: {
          productId: { in: bulkProductIds },
          fromEntityType: fromEntityType,
          ...(fromEntityType === 'WAREHOUSE' ? {} : { fromEntityId: fromEntityId || null }),
        },
        _sum: { quantity: true },
      })
    ]);

    inboundSums.forEach(s => {
      stockMap.set(s.productId, (s._sum.quantity || 0));
    });
    outboundSums.forEach(s => {
      const current = stockMap.get(s.productId) || 0;
      stockMap.set(s.productId, current - (s._sum.quantity || 0));
    });
  }

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
          },
        });

        if (finalToEntityType === 'STORE' && finalToEntityId) {
          await tx.brand.update({
            where: { id: product.brandId },
            data: {
              stores: {
                connect: { id: finalToEntityId }
              }
            }
          });
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
            
            // Generate staff ID inside tx
            const staffRecords = await tx.staff.findMany({
              where: { id: { startsWith: 'STAF' } },
              select: { id: true }
            });
            let maxStaffNum = 0;
            for (const r of staffRecords) {
              const parts = r.id.split('-');
              const numPart = parts[parts.length - 1];
              const parsed = parseInt(numPart, 10);
              if (!isNaN(parsed) && parsed > maxStaffNum) {
                maxStaffNum = parsed;
              }
            }
            const nextStaffNum = maxStaffNum + 1;
            const staffIdVal = `STAF-${String(nextStaffNum).padStart(3, '0')}`;

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
            // Generate allocation ID inside tx
            const allocRecords = await tx.staffUniformAllocation.findMany({
              where: { id: { startsWith: 'ALOC' } },
              select: { id: true }
            });
            let maxAllocNum = 0;
            for (const r of allocRecords) {
              const parts = r.id.split('-');
              const numPart = parts[parts.length - 1];
              const parsed = parseInt(numPart, 10);
              if (!isNaN(parsed) && parsed > maxAllocNum) {
                maxAllocNum = parsed;
              }
            }
            const nextAllocNum = maxAllocNum + 1;
            const allocIdVal = `ALOC-${String(nextAllocNum).padStart(5, '0')}`;

            await tx.staffUniformAllocation.create({
              data: {
                id: allocIdVal,
                staffId: finalStaffId,
                storeId,
                uniformQty: 0,
                capQty: 0,
                uniformReturned: false,
                capReturned: false,
                allocatedItems,
                workingPeriod,
                notes: promoterNotes || null,
              }
            });
          }
        }

        // B. Link serialized serials
        if (product.isSerialized && barcodes.length > 0) {
          const itemSerials = barcodes.map(b => serialsMap.get(b)).filter(Boolean);
          let nextStatus = 'AVAILABLE';
          if (toEntityType === 'CLIENT' || toEntityType === 'STAFF' || toEntityType === 'DIRECT') nextStatus = 'USED';

          // Bulk update location and status (1 write)
          await tx.productSerialNumber.updateMany({
            where: {
              id: { in: itemSerials.map(s => s.id) }
            },
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

    return createdTxs;
  }, { timeout: 20000 });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transactions;
}


export async function createBulkReceiveTransactions(formData) {
  await checkAuth();

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

  // 2. Pre-generate IDs for new products
  const newProductItems = items.filter(i => i.isNewProduct);
  let nextProductNum = 1;
  if (newProductItems.length > 0) {
    const existingProducts = await prisma.product.findMany({
      where: { id: { startsWith: 'PROD' } },
      select: { id: true }
    });
    let maxProdNum = 0;
    for (const p of existingProducts) {
      const match = p.id.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxProdNum) maxProdNum = num;
      }
    }
    nextProductNum = maxProdNum + 1;
  }

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
      const deliveryNote = await generateCustomRef(tx, 'RCV', brandName, transactionDate);

      for (const { item, idx } of brandGroup) {
        let { productId, quantity, barcodes = [], notes, manufactureDate, expiryDate, isNewProduct } = item;
        let product;

        if (isNewProduct) {
          // Register the product inline!
          const { prodName, prodType, prodBrandId, prodCategory, prodSize, prodItemCode, prodLowStockAlert = '10', prodIsReturnable, prodIsDisposable, prodRack, prodShelf } = item;

          const brandObj = await tx.brand.findUnique({
            where: { id: prodBrandId },
            select: { name: true }
          });
          const bName = brandObj?.name || '';
          let formattedName = prodName.trim();
          if (bName) {
            const lowerName = formattedName.toLowerCase();
            const lowerBrand = bName.toLowerCase();
            if (!lowerName.startsWith(lowerBrand)) {
              formattedName = `${bName} - ${formattedName}`;
            }
          }

          const padded = String(nextProductNum).padStart(3, '0');
          const newProductId = `PROD-${padded}`;
          nextProductNum++;

          const imageUrl = imageUrlsMap.get(idx) || null;

          let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
          if (!itemCodeToSave) {
            itemCodeToSave = await generateSkuCode(tx, bName, prodCategory || 'General');
          }

          product = await tx.product.create({
            data: {
              id: newProductId,
              name: formattedName,
              isSerialized: prodType === 'SIM' || prodType === 'ROUTER',
              productType: prodType,
              brandId: prodBrandId,
              category: prodCategory || 'General',
              size: prodSize || null,
              itemCode: itemCodeToSave,
              rack: prodRack || null,
              shelf: prodShelf || null,
              lowStockAlert: parseInt(prodLowStockAlert, 10) || 10,
              isReturnable: !!prodIsReturnable,
              isDisposable: !!prodIsDisposable,
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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/products');
  return transactions;
}


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
        include: { brand: { select: { name: true } } },
      });

      if (!product) throw new Error(`Product not found for ID: ${productId}`);

      const brandName = product.brand?.name || 'General';
      const typeCode = resolvedType === 'LOST' ? 'LOS' : 'DAM';
      const deliveryNote = await generateCustomRef(tx, typeCode, brandName);

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
          notes: notes ? notes.trim() : null,
          deliveryStatus: 'Delivered',
          deliveryNote,
        },
      });

      // B. Link serialized serials and mark as DAMAGED/LOST
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

        // Bulk mark serial records as DAMAGED or LOST
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

        // Bulk insert the transaction-serial mappings
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
    const brandObj = await prisma.brand.findUnique({
      where: { id: prodBrandId },
      select: { name: true }
    });
    const bName = brandObj?.name || '';
    
    let itemCodeToSave = prodItemCode ? prodItemCode.trim() : null;
    if (!itemCodeToSave) {
      itemCodeToSave = await generateSkuCode(prisma, bName, prodCategory || 'General');
    }

    const newProduct = await prisma.product.create({
      data: {
        id: newProdId,
        name: prodName.trim(),
        brandId: prodBrandId,
        itemCode: itemCodeToSave,
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

        const product = await tx.product.findUnique({
          where: { id: originalTx.productId },
          include: { brand: { select: { name: true } } }
        });
        const brandName = product?.brand?.name || 'General';
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
          }
        });

      } else if (actionType === 'USED') {
        const remainingQty = originalTx.quantity - (originalTx.returnedQty || 0);
        if (remainingQty <= 0) throw new Error('No remaining quantity to mark as used');

        const newNotes = originalTx.returnNotes ? `${originalTx.returnNotes} | ${notes || 'Marked Used'}` : (notes || 'Marked Used');

        // 1. Update original Outbound transaction
        await tx.inventoryTransaction.update({
          where: { id: transactionId },
          data: {
            returnStatus: 'USED',
            returnNotes: newNotes,
            returnedQty: originalTx.quantity, // Set to max so it's fully processed
          }
        });

        // 2. Create USED transaction to move stock from Store to Staff (Used)
        const product = await tx.product.findUnique({
          where: { id: originalTx.productId },
          include: { brand: { select: { name: true } } }
        });
        const brandName = product?.brand?.name || 'General';
        const deliveryNote = await generateCustomRef(tx, 'USD', brandName);

        await tx.inventoryTransaction.create({
          data: {
            productId: originalTx.productId,
            transactionType: 'ISSUE',
            fromEntityType: originalTx.toEntityType,
            fromEntityId: originalTx.toEntityId,
            toEntityType: 'STAFF',
            toEntityId: null,
            quantity: remainingQty,
            notes: `Marked as Used from Outbound ${transactionId}. ${notes || ''}`,
            deliveryStatus: 'Delivered',
            deliveryNote,
          }
        });
      } else {
        throw new Error(`Unknown action type: ${actionType}`);
      }
    }
  }, { timeout: 20000 });

  revalidatePath('/dashboard/outbound');
  revalidatePath('/dashboard/returns');
  revalidatePath('/dashboard/used');
  revalidatePath('/dashboard/reports');
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

    // 2. CHECK STOCK & CREATE NEW TRANSACTIONS
    const stockMap = new Map();
    if (bulkProductIds.length > 0 && fromEntityType && fromEntityType !== 'SUPPLIER') {
      const [inboundSums, outboundSums] = await Promise.all([
        tx.inventoryTransaction.groupBy({
          by: ['productId'],
          where: {
            productId: { in: bulkProductIds },
            toEntityType: fromEntityType,
            ...(fromEntityType === 'WAREHOUSE' ? {} : { toEntityId: fromEntityId || null }),
          },
          _sum: { quantity: true },
        }),
        tx.inventoryTransaction.groupBy({
          by: ['productId'],
          where: {
            productId: { in: bulkProductIds },
            fromEntityType: fromEntityType,
            ...(fromEntityType === 'WAREHOUSE' ? {} : { fromEntityId: fromEntityId || null }),
          },
          _sum: { quantity: true },
        })
      ]);

      inboundSums.forEach(s => {
        stockMap.set(s.productId, (s._sum.quantity || 0));
      });
      outboundSums.forEach(s => {
        const current = stockMap.get(s.productId) || 0;
        stockMap.set(s.productId, current - (s._sum.quantity || 0));
      });
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
  }, { timeout: 20000 });

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

  // Constraint: Check if any of these products have been dispatched outbound since this receipt
  for (const oldTx of oldTxs) {
    const issueExists = await prisma.inventoryTransaction.findFirst({
      where: {
        productId: oldTx.productId,
        transactionType: 'ISSUE',
        timestamp: { gt: oldTx.timestamp }
      }
    });
    if (issueExists) {
      throw new Error(`Cannot edit this Inbound receipt. Product "${oldTx.product.name}" has already been dispatched outbound since this receipt.`);
    }
  }

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

        const newProduct = await tx.product.create({
          data: {
            name: prodName,
            type: prodType,
            brandId: prodBrandId,
            category: prodCategory || null,
            size: prodSize || null,
            itemCode: itemCodeToSave,
            rack: prodRack || null,
            shelf: prodShelf || null,
            isSerialized: (prodType === 'SIM' || prodType === 'ROUTER'),
            isReturnable: prodIsReturnable,
            isDisposable: prodIsDisposable,
            lowStockAlert: prodLowStockAlert ? parseInt(prodLowStockAlert, 10) : 0,
            imageUrl: imageUrl,
          }
        });
        productId = newProduct.id;
      }

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { brand: { select: { name: true } } }
      });

      if (!product) {
        throw new Error(`Product not found for ID: ${productId}`);
      }

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
  }, { timeout: 20000 });

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

