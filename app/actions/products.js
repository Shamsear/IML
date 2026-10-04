'use server';

import { prisma } from '@/lib/prisma';
import { generateId } from '@/lib/idGenerator';
import { revalidatePath } from 'next/cache';

import { requireAuth } from '@/lib/auth-guard';
import { uploadToImageKit } from '@/lib/imagekit';
import { generateCustomRef, generateSkuCode } from '@/lib/ledger';
import { getProductStock } from '@/lib/stock';

async function saveFile(file) {
  return uploadToImageKit(file);
}

function revalidateProductPaths() {
  revalidatePath('/dashboard/products');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard');
}

// ─── Shared warehouse stock calculation ──────────────────────────────────────
// Extracted to eliminate the ~80-line duplication between getProducts() and getProductsSlim().
async function computeWarehouseStockMap(products) {
  if (!products || products.length === 0) return new Map();
  const productIds = products.map(p => p.id);

  const [aggregates, serialsCount] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType'],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    }),
    prisma.productSerialNumber.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: 'AVAILABLE',
        OR: [
          { currentLocationType: 'WAREHOUSE' },
          { currentLocationType: null }
        ]
      },
      _count: { id: true }
    })
  ]);

  const serialsMap = new Map(serialsCount.map(s => [s.productId, s._count.id]));

  const aggsMap = new Map();
  aggregates.forEach(agg => {
    if (!aggsMap.has(agg.productId)) aggsMap.set(agg.productId, []);
    aggsMap.get(agg.productId).push(agg);
  });

  // Expiry-aware stock for products that track expiry
  const expiryProducts = products.filter(p => !p.isSerialized && p.trackExpiry).map(p => p.id);
  let expiryStockMap = {};
  if (expiryProducts.length > 0) {
    const expiryTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: { in: expiryProducts },
        OR: [
          { fromEntityType: 'WAREHOUSE' },
          { toEntityType: 'WAREHOUSE' }
        ]
      },
      select: {
        productId: true, transactionType: true, quantity: true,
        manufactureDate: true, expiryDate: true,
        fromEntityType: true, toEntityType: true,
      },
      orderBy: { timestamp: 'asc' }
    });

    const now = new Date();
    for (const prodId of expiryProducts) {
      const prodTxs = expiryTransactions.filter(tx => tx.productId === prodId);
      const batches = {};
      for (const tx of prodTxs) {
        const m = tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '';
        const e = tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '';
        const key = `${m}|${e}`;
        if (!batches[key]) batches[key] = { expiryDate: tx.expiryDate, quantity: 0 };
        if (tx.toEntityType === 'WAREHOUSE' && ['RECEIVE', 'RETURN', 'REBRAND_IN'].includes(tx.transactionType)) {
          batches[key].quantity += tx.quantity;
        } else if (tx.fromEntityType === 'WAREHOUSE' && ['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT'].includes(tx.transactionType)) {
          batches[key].quantity -= tx.quantity;
        }
      }
      let available = 0;
      for (const b of Object.values(batches)) {
        if (b.quantity > 0 && !(b.expiryDate && new Date(b.expiryDate) < now)) {
          available += b.quantity;
        }
      }
      expiryStockMap[prodId] = Math.max(0, available);
    }
  }

  // Compute final stock map
  const stockMap = new Map();
  for (const product of products) {
    let warehouseStock = 0;
    if (product.isSerialized) {
      warehouseStock = serialsMap.get(product.id) || 0;
    } else if (product.trackExpiry) {
      warehouseStock = expiryStockMap[product.id] || 0;
    } else {
      const productAggs = aggsMap.get(product.id) || [];
      for (const t of productAggs) {
        const qty = t._sum.quantity || 0;
        const type = t.transactionType;
        const from = t.fromEntityType;
        const to = t.toEntityType;

        // Inbound to warehouse
        if (to === 'WAREHOUSE' || (!to && ['RECEIVE', 'INITIAL', 'REBRAND_IN', 'CLIENT_RETURN'].includes(type))) {
          if (type === 'RETURN' && (to === 'VENDOR' || to === 'SUPPLIER')) {
            warehouseStock -= qty;
          } else {
            warehouseStock += qty;
          }
        }
        // Outbound from warehouse
        else if (from === 'WAREHOUSE' || (!from && ['ISSUE', 'USED', 'DAMAGE', 'LOST', 'REBRAND', 'REBRAND_OUT', 'CLIENT_STOCK'].includes(type))) {
          if (type === 'RETURN' && (to === 'VENDOR' || to === 'SUPPLIER')) {
            warehouseStock -= qty;
          } else if (['ISSUE', 'USED', 'DAMAGE', 'LOST', 'REBRAND', 'REBRAND_OUT', 'CLIENT_STOCK'].includes(type)) {
            warehouseStock -= qty;
          }
        }
      }
      warehouseStock = Math.max(0, warehouseStock);
    }
    stockMap.set(product.id, warehouseStock);
  }

  return stockMap;
}

export async function getProducts() {
  await requireAuth();

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      brand: { select: { id: true, name: true } },
      _count: { select: { serialNumbers: true } }
    }
  });

  const stockMap = await computeWarehouseStockMap(products);

  return products.map(product => ({
    ...product,
    warehouseStock: stockMap.get(product.id) || 0,
  }));
}

export async function getProductsSlim() {
  await requireAuth();

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      itemCode: true,
      isSerialized: true,
      trackExpiry: true,
      category: true,
      imageUrl: true,
      isReturnable: true,
      isDisposable: true,
      size: true,
      rack: true,
      shelf: true,
      brand: { select: { id: true, name: true, rack: true, shelf: true } }
    }
  });

  const stockMap = await computeWarehouseStockMap(products);

  return products.map(product => ({
    ...product,
    warehouseStock: stockMap.get(product.id) || 0,
  }));
}

export async function createProduct(formData) {
  await requireAuth();

  const name = formData.get('name');
  const brandId = formData.get('brandId');
  const itemCode = formData.get('itemCode') || null;
  const category = formData.get('category') || null;
  const imageFile = formData.get('imageFile');
  let imageUrl = formData.get('imageUrl') || null;

  if (imageFile && imageFile.size > 0) {
    const savedPath = await saveFile(imageFile);
    if (savedPath) imageUrl = savedPath;
  }

  const isReturnable = formData.get('isReturnable') === 'true';
  const isDisposable = formData.get('isDisposable') === 'true';
  const trackExpiry = formData.get('trackExpiry') === 'true';
  const isPublic = formData.get('isPublic') === 'true';
  const isSerialized = formData.get('isSerialized') === 'true';
  const stockCap = formData.get('stockCap') ? parseInt(formData.get('stockCap'), 10) : null;
  const rack = formData.get('rack') || null;
  const shelf = formData.get('shelf') || null;

  if (!name) throw new Error('Product name is required');
  if (!brandId) throw new Error('Associated Brand is required');

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
  });
  if (!brand) throw new Error('Associated Brand not found');

  let formattedName = name.trim();
  const lowerName = formattedName.toLowerCase();
  const lowerBrand = brand.name.toLowerCase();
  if (!lowerName.startsWith(lowerBrand)) {
    formattedName = `${brand.name} - ${formattedName}`;
  }

  // 1. Create product row
  const id = await generateId('product', 'PROD', 3);

  let itemCodeToSave = itemCode ? itemCode.trim() : null;
  if (!itemCodeToSave) {
    itemCodeToSave = await generateSkuCode(prisma, brand.name, category || 'General');
  }

  const product = await prisma.product.create({
    data: {
      id,
      name: formattedName,
      brandId,
      itemCode: itemCodeToSave,
      category,
      imageUrl,
      rack,
      shelf,
      isReturnable,
      isDisposable,
      trackExpiry,
      isPublic,
      isSerialized,
      stockCap,
    },
  });

  // 2. Read optional initial stock parameters
  const initialQty = parseInt(formData.get('initialQty'), 10) || 0;
  const initialBarcodesStr = formData.get('initialBarcodes') || '';
  const rawDeliveryNote = formData.get('deliveryNote');
  let deliveryNote = (rawDeliveryNote && rawDeliveryNote.trim() && rawDeliveryNote !== 'INITIAL_STOCK')
    ? rawDeliveryNote.trim()
    : null;

  if (!deliveryNote) {
    const cleanBrand = brand.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 3) || 'gen';
    const dateObj = new Date();
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;
    const prefix = `recieved-brand(${cleanBrand})-date(${dateStr})-`;
    const existing = await prisma.inventoryTransaction.findMany({
      where: { deliveryNote: { startsWith: prefix } },
      select: { deliveryNote: true },
      distinct: ['deliveryNote']
    });
    const nextNum = existing.length + 1;
    const suffix = String(nextNum).padStart(3, '0');
    deliveryNote = `${prefix}${suffix}`;
  }
  const notesStr = formData.get('notes') || 'Auto-received initial stock on product registration';

  const fromEntityType = formData.get('fromEntityType') || 'SUPPLIER';
  const fromEntityId = formData.get('fromEntityId') || 'Initial Import';
  const toEntityType = formData.get('toEntityType') || 'WAREHOUSE';
  const toEntityId = formData.get('toEntityId') || null;
  const receivedBy = formData.get('receivedBy') || null;

  if (isSerialized) {
    const barcodes = initialBarcodesStr.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
    if (barcodes.length > 0) {
      const lastSerial = await prisma.productSerialNumber.findFirst({
        where: { id: { startsWith: 'SERL' } },
        orderBy: { id: 'desc' },
        select: { id: true }
      });
      let nextSerNum = 1;
      if (lastSerial) {
        const parts = lastSerial.id.split('-');
        const numPart = parts[parts.length - 1];
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) nextSerNum = parsed + 1;
      }

      const data = barcodes.map((barcode, idx) => ({
        id: `SERL-${String(nextSerNum + idx).padStart(5, '0')}`,
        productId: product.id,
        barcode,
        currentLocationType: toEntityType,
        currentLocationId: toEntityId || null,
        status: 'AVAILABLE',
      }));

      await prisma.productSerialNumber.createMany({
        data,
        skipDuplicates: true,
      });

      const serials = await prisma.productSerialNumber.findMany({
        where: {
          productId: product.id,
          barcode: { in: barcodes }
        }
      });

      const txId = await generateId('inventoryTransaction', 'TRAN', 5);

      await prisma.inventoryTransaction.create({
        data: {
          id: txId,
          productId: product.id,
          transactionType: 'RECEIVE',
          fromEntityType,
          fromEntityId,
          toEntityType,
          toEntityId,
          quantity: serials.length,
          deliveryNote,
          notes: notesStr,
          receivedBy,
          serialNumbers: {
            create: serials.map(s => ({
              serialNumberId: s.id
            }))
          }
        }
      });
    }
  } else if (initialQty > 0) {
    const txId = await generateId('inventoryTransaction', 'TRAN', 5);

    await prisma.inventoryTransaction.create({
      data: {
        id: txId,
        productId: product.id,
        transactionType: 'RECEIVE',
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        quantity: initialQty,
        deliveryNote,
        notes: notesStr,
        receivedBy,
      }
    });
  }

  revalidateProductPaths();
  return product;
}

export async function updateProduct(id, formData) {
  await requireAuth();

  const name = formData.get('name');
  const brandId = formData.get('brandId');
  const itemCode = formData.get('itemCode') || null;
  const category = formData.get('category') || null;
  const size = formData.get('size') || null;
  const imageFile = formData.get('imageFile');
  let imageUrl = formData.get('imageUrl') || null;

  if (imageFile && imageFile.size > 0) {
    const savedPath = await saveFile(imageFile);
    if (savedPath) imageUrl = savedPath;
  }

  const isReturnable = formData.get('isReturnable') === 'true';
  const isDisposable = formData.get('isDisposable') === 'true';
  const trackExpiry = formData.get('trackExpiry') === 'true';
  const isPublic = formData.get('isPublic') === 'true';
  const isSerialized = formData.get('isSerialized') === 'true';
  const stockCap = formData.get('stockCap') ? parseInt(formData.get('stockCap'), 10) : null;
  const rack = formData.get('rack') || null;
  const shelf = formData.get('shelf') || null;

  if (!name) throw new Error('Product name is required');
  if (!brandId) throw new Error('Associated Brand is required');

  await prisma.product.update({
    where: { id },
    data: {
      name,
      brandId,
      itemCode,
      category,
      size,
      imageUrl,
      rack,
      shelf,
      isReturnable,
      isDisposable,
      trackExpiry,
      isPublic,
      isSerialized,
      stockCap,
    },
  });

  revalidateProductPaths();
}

export async function deleteProduct(id) {
  await requireAuth();

  await prisma.product.delete({
    where: { id },
  });

  revalidateProductPaths();
}

// Upload/import barcodes in bulk for a serialized product
export async function importBarcodes(productId, barcodes = [], secondaryBarcodes = []) {
  await requireAuth();

  if (!productId) throw new Error('Product ID is required');
  if (barcodes.length === 0) throw new Error('No barcodes provided');

  const lastSerial = await prisma.productSerialNumber.findFirst({
    where: { id: { startsWith: 'SERL' } },
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  let nextSerNum = 1;
  if (lastSerial) {
    const parts = lastSerial.id.split('-');
    const numPart = parts[parts.length - 1];
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextSerNum = parsed + 1;
  }

  const data = barcodes.map((barcode, idx) => ({
    id: `SERL-${String(nextSerNum + idx).padStart(5, '0')}`,
    productId,
    barcode: barcode.trim(),
    secondaryBarcode: secondaryBarcodes[idx] ? secondaryBarcodes[idx].trim() : null,
    currentLocationType: 'WAREHOUSE', // Fresh barcodes start in the main Warehouse
    status: 'AVAILABLE',
  }));

  // Create barcodes in bulk, ignore duplicates
  const result = await prisma.productSerialNumber.createMany({
    data,
    skipDuplicates: true,
  });

  revalidateProductPaths();
  return result.count; // Return number of successfully imported barcodes
}

// Fetch barcodes for a single product
export async function getProductSerials(productId) {
  await requireAuth();
  return prisma.productSerialNumber.findMany({
    where: { productId },
    select: {
      id: true,
      barcode: true,
      currentLocationType: true,
      status: true
    },
    orderBy: { barcode: 'asc' },
  });
}

// Fetch active barcodes currently at a specific location
export async function getActiveSerialsAtLocation(productId, locationType, locationId) {
  await requireAuth();
  return prisma.productSerialNumber.findMany({
    where: {
      productId,
      currentLocationType: locationType,
      currentLocationId: locationId || null,
      status: 'AVAILABLE',
    },
    orderBy: { barcode: 'asc' },
  });
}

// Bulk create products from CSV import
export async function bulkCreateProducts(productsList) {
  await requireAuth();

  if (!productsList || productsList.length === 0) {
    throw new Error('No products list provided');
  }

  const lastRecord = await prisma.product.findFirst({
    where: { id: { startsWith: 'PROD' } },
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

  const data = productsList.map((p, idx) => ({
    id: `PROD-${String(nextNum + idx).padStart(3, '0')}`,
    name: p.name,
    brandId: p.brandId,
    itemCode: p.itemCode || null,
    category: p.category || null,
    isReturnable: !!p.isReturnable,
    isDisposable: !!p.isDisposable,
    isPublic: p.isPublic !== false,
    isSerialized: !!p.isSerialized,
    stockCap: p.stockCap ? parseInt(p.stockCap, 10) : null,
  }));

  const result = await prisma.product.createMany({
    data,
    skipDuplicates: true,
  });

  revalidateProductPaths();
  return result.count;
}

// Bulk update multiple products
export async function bulkUpdateProducts(ids = [], updateData = {}) {
  await requireAuth();

  if (ids.length === 0) throw new Error('No product IDs specified');

  const data = {};
  if (updateData.brandId !== undefined) data.brandId = updateData.brandId;
  if (updateData.category !== undefined) data.category = updateData.category;
  if (updateData.isReturnable !== undefined) data.isReturnable = !!updateData.isReturnable;
  if (updateData.isDisposable !== undefined) data.isDisposable = !!updateData.isDisposable;
  if (updateData.isPublic !== undefined) data.isPublic = !!updateData.isPublic;

  await prisma.product.updateMany({
    where: { id: { in: ids } },
    data,
  });

  revalidateProductPaths();
}

// Bulk delete multiple products
export async function bulkDeleteProducts(ids = []) {
  await requireAuth();

  if (ids.length === 0) throw new Error('No product IDs specified');

  await prisma.product.deleteMany({
    where: { id: { in: ids } },
  });

  revalidateProductPaths();
}

// Fetch available barcodes/serials at a specific location
export async function getAvailableBarcodes(productId, locationType, locationId = null) {
  await requireAuth();
  return prisma.productSerialNumber.findMany({
    where: {
      productId,
      status: 'AVAILABLE',
      OR: [
        { currentLocationType: locationType },
        { currentLocationType: null }
      ]
    },
    select: {
      id: true,
      barcode: true,
      secondaryBarcode: true
    },
    orderBy: {
      barcode: 'asc'
    }
  });
}

export async function getProductStockAtLocation(productId, locationType, locationId = null) {
  await requireAuth();
  
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { isSerialized: true, trackExpiry: true }
  });

  if (!product) return 0;

  if (product.isSerialized) {
    return prisma.productSerialNumber.count({
      where: {
        productId,
        currentLocationType: locationType,
        currentLocationId: locationId ? locationId : null,
        status: 'AVAILABLE'
      }
    });
  }

  if (!product.trackExpiry) {
    const isWarehouse = locationType === 'WAREHOUSE';
    const isBrand = locationType === 'BRAND' || locationType === 'CLIENT';

    const whereTo = isWarehouse
      ? { toEntityType: 'WAREHOUSE' }
      : isBrand
      ? { OR: [{ toEntityType: 'BRAND', toEntityId: locationId || null }, { toEntityType: 'CLIENT', toEntityId: locationId || null }] }
      : { toEntityType: locationType, toEntityId: locationId || null };

    const whereFrom = isWarehouse
      ? { fromEntityType: 'WAREHOUSE' }
      : isBrand
      ? { OR: [{ fromEntityType: 'BRAND', fromEntityId: locationId || null }, { fromEntityType: 'CLIENT', fromEntityId: locationId || null }] }
      : { fromEntityType: locationType, fromEntityId: locationId || null };

    const [inboundSum, outboundSum] = await Promise.all([
      prisma.inventoryTransaction.aggregate({
        where: {
          productId,
          ...whereTo,
        },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.aggregate({
        where: {
          productId,
          ...whereFrom,
        },
        _sum: { quantity: true },
      })
    ]);

    const inQty = inboundSum._sum.quantity || 0;
    const outQty = outboundSum._sum.quantity || 0;
    return Math.max(0, inQty - outQty);
  }

  // Expiry tracking enabled - calculate sum of available non-expired batches
  const batches = await getProductBatchesAtLocation(productId, locationType, locationId);
  const now = new Date();
  let availableQty = 0;
  for (const batch of batches) {
    const isExpired = batch.expiryDate && new Date(batch.expiryDate) < now;
    if (!isExpired) {
      availableQty += batch.quantity;
    }
  }

  return Math.max(0, availableQty);
}

// Fetch available stock batches at a specific location for bulk products tracking expiry
export async function getProductBatchesAtLocation(productId, locationType, locationId = null) {
  await requireAuth();

  const isWarehouse = locationType === 'WAREHOUSE';
  const isBrand = locationType === 'BRAND' || locationType === 'CLIENT';

  const whereTo = isWarehouse
    ? { toEntityType: 'WAREHOUSE' }
    : isBrand
    ? { OR: [{ toEntityType: 'BRAND', toEntityId: locationId || null }, { toEntityType: 'CLIENT', toEntityId: locationId || null }] }
    : { toEntityType: locationType, toEntityId: locationId || null };

  const whereFrom = isWarehouse
    ? { fromEntityType: 'WAREHOUSE' }
    : isBrand
    ? { OR: [{ fromEntityType: 'BRAND', fromEntityId: locationId || null }, { fromEntityType: 'CLIENT', fromEntityId: locationId || null }] }
    : { fromEntityType: locationType, fromEntityId: locationId || null };

  const [inbounds, outbounds] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        productId,
        ...whereTo,
      },
      select: {
        quantity: true,
        manufactureDate: true,
        expiryDate: true
      }
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        productId,
        ...whereFrom,
      },
      select: {
        quantity: true,
        manufactureDate: true,
        expiryDate: true
      }
    })
  ]);

  const batches = {};

  inbounds.forEach(tx => {
    const mDateStr = tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '';
    const eDateStr = tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '';
    const key = `${mDateStr}|${eDateStr}`;

    if (!batches[key]) {
      batches[key] = {
        manufactureDate: tx.manufactureDate,
        expiryDate: tx.expiryDate,
        quantity: 0
      };
    }
    batches[key].quantity += tx.quantity;
  });

  outbounds.forEach(tx => {
    const mDateStr = tx.manufactureDate ? new Date(tx.manufactureDate).toISOString().split('T')[0] : '';
    const eDateStr = tx.expiryDate ? new Date(tx.expiryDate).toISOString().split('T')[0] : '';
    const key = `${mDateStr}|${eDateStr}`;

    if (!batches[key]) {
      batches[key] = {
        manufactureDate: tx.manufactureDate,
        expiryDate: tx.expiryDate,
        quantity: 0
      };
    }
    batches[key].quantity -= tx.quantity;
  });

  return Object.values(batches).filter(b => b.quantity > 0);
}

// Find a product and its location availability details by serial barcode
export async function findProductByBarcode(barcode) {
  await requireAuth();
  if (!barcode) return null;
  
  const serial = await prisma.productSerialNumber.findUnique({
    where: { barcode: barcode.trim() },
    select: {
      id: true,
      barcode: true,
      secondaryBarcode: true,
      status: true,
      currentLocationType: true,
      currentLocationId: true,
      product: {
        select: {
          id: true,
          name: true,
          isSerialized: true,
          category: true,
          brand: { select: { id: true, name: true } }
        }
      }
    }
  });

  return serial;
}

export async function getProductById(id) {
  await requireAuth();
  if (!id) return null;
  return prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } }
    }
  });
}

/**
 * Fetch full product detail with transactions, serials, and stock calculation.
 * Used by the product detail page.
 */
export async function getProductDetail(id) {
  await requireAuth();
  if (!id) return null;

  const [product, allStockTxs] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, imageUrl: true } },
        _count: { select: { serialNumbers: true, transactions: true } },
        transactions: {
          orderBy: { timestamp: 'desc' },
          take: 100,
          select: {
            id: true,
            transactionType: true,
            quantity: true,
            fromEntityType: true,
            fromEntityId: true,
            toEntityType: true,
            toEntityId: true,
            deliveryNote: true,
            notes: true,
            timestamp: true,
            returnStatus: true,
            returnedQty: true,
            manufactureDate: true,
            expiryDate: true,
          },
        },
        serialNumbers: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            id: true,
            barcode: true,
            secondaryBarcode: true,
            status: true,
            currentLocationType: true,
            currentLocationId: true,
            manufactureDate: true,
            expiryDate: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.inventoryTransaction.findMany({
      where: { productId: id },
      select: {
        transactionType: true,
        quantity: true,
        fromEntityType: true,
        toEntityType: true,
        returnStatus: true,
      }
    })
  ]);

  if (!product) return null;

  // Compute warehouse stock using the same logic as computeWarehouseStockMap
  const stockMap = await computeWarehouseStockMap([product]);
  const warehouseStock = stockMap.get(product.id) || 0;

  // Compute full stock breakdown from ALL transactions
  const stock = getProductStock(allStockTxs);

  if (product.isSerialized) {
    const serialAggs = await prisma.productSerialNumber.groupBy({
      by: ['status', 'currentLocationType'],
      where: { productId: id },
      _count: { id: true }
    });

    let sWarehouse = 0;
    let sIssued = 0;
    let sUsed = 0;
    let sWithClient = 0;
    let sDamage = 0;
    let sLost = 0;

    serialAggs.forEach(item => {
      const count = item._count.id || 0;
      const status = item.status;
      const loc = item.currentLocationType;

      if (status === 'AVAILABLE') {
        if (loc === 'STORE') {
          sIssued += count;
        } else {
          sWarehouse += count;
        }
      } else if (status === 'WITH_CLIENT' || loc === 'CLIENT' || loc === 'BRAND') {
        sWithClient += count;
      } else if (status === 'DAMAGED') {
        sDamage += count;
      } else if (status === 'LOST') {
        sLost += count;
      } else if (status === 'USED' || loc === 'STAFF') {
        sUsed += count;
      }
    });

    stock.warehouse = sWarehouse;
    stock.withClient = sWithClient;
    stock.damage = sDamage;
    stock.lost = sLost;
    stock.issued = sIssued;
    stock.used = sUsed;
    stock.total = sWarehouse;
  }

  return {
    ...product,
    warehouseStock,
    stock,
  };
}

export async function createBulkProducts(formData) {
  await requireAuth();

  const count = parseInt(formData.get('count'), 10) || 0;
  if (count === 0) {
    throw new Error('No products provided for creation');
  }

  // Parse list structures and handle files
  const rawProducts = [];
  for (let i = 0; i < count; i++) {
    const name = formData.get(`item_${i}_name`);
    const brandId = formData.get(`item_${i}_brandId`);
    const itemCode = formData.get(`item_${i}_itemCode`) || null;
    const category = formData.get(`item_${i}_category`) || 'Stands';
    const size = formData.get(`item_${i}_size`) || null;
    const productType = formData.get(`item_${i}_productType`) || 'NORMAL';
    const stockCap = formData.get(`item_${i}_stockCap`);
    const isReturnable = formData.get(`item_${i}_isReturnable`) === 'true';
    const trackExpiry = formData.get(`item_${i}_trackExpiry`) === 'true';
    const isPublic = formData.get(`item_${i}_isPublic`) === 'true';
    const rack = formData.get(`item_${i}_rack`) || null;
    const shelf = formData.get(`item_${i}_shelf`) || null;

    const inboundCount = parseInt(formData.get(`item_${i}_inboundCount`), 10) || 0;
    const inbounds = [];
    for (let j = 0; j < inboundCount; j++) {
      inbounds.push({
        qty: parseInt(formData.get(`item_${i}_inbound_${j}_qty`), 10) || 0,
        barcodes: formData.get(`item_${i}_inbound_${j}_barcodes`) || '',
        fromId: formData.get(`item_${i}_inbound_${j}_fromId`) || 'Initial Import',
        receivedBy: formData.get(`item_${i}_inbound_${j}_receivedBy`) || null,
        deliveryNote: (() => {
          const val = formData.get(`item_${i}_inbound_${j}_deliveryNote`);
          return (val && val.trim() && val !== 'INITIAL_STOCK')
            ? val.trim()
            : null; // Will be generated using proper format in transaction
        })(),
        notes: formData.get(`item_${i}_inbound_${j}_notes`) || 'Auto-received initial stock',
        manufactureDate: formData.get(`item_${i}_inbound_${j}_manufactureDate`) || null,
        expiryDate: formData.get(`item_${i}_inbound_${j}_expiryDate`) || null,
      });
    }

    const imageFile = formData.get(`item_${i}_imageFile`);
    let imageUrl = formData.get(`item_${i}_imageUrl`) || null;

    rawProducts.push({
      name,
      brandId,
      itemCode,
      category,
      size,
      productType,
      stockCap,
      isReturnable,
      trackExpiry,
      isPublic,
      rack,
      shelf,
      inbounds,
      imageFile,
      imageUrl
    });
  }

  // 1. Parallelize image uploads to ImageKit outside the database transaction lock
  const uploadedUrls = await Promise.all(
    rawProducts.map(async (p) => {
      if (p.imageFile && p.imageFile.size > 0) {
        const savedPath = await saveFile(p.imageFile);
        return savedPath || p.imageUrl;
      }
      return p.imageUrl;
    })
  );

  const productsList = rawProducts.map((p, idx) => ({
    ...p,
    imageUrl: uploadedUrls[idx],
  }));

  // 2. Pre-fetch all associated brands in a single batch query
  const brandIds = [...new Set(productsList.map(p => p.brandId).filter(Boolean))];
  const dbBrands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: { id: true, name: true }
  });
  const brandsMap = new Map(dbBrands.map(b => [b.id, b.name]));

  // Use a transaction to register all products and transactions
  const results = await prisma.$transaction(async (tx) => {
    const createdProducts = [];
    let serialOffset = 0;

    // Get last serial ID number in database to safely generate consecutive IDs
    const lastSerial = await tx.productSerialNumber.findFirst({
      where: { id: { startsWith: 'SERL' } },
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    let nextSerNum = 1;
    if (lastSerial) {
      const parts = lastSerial.id.split('-');
      const numPart = parts[parts.length - 1];
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextSerNum = parsed + 1;
    }

    // Get last product ID dynamically to prevent race conditions
    const lastRecord = await tx.product.findFirst({
      where: { id: { startsWith: 'PROD' } },
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    let maxProdNum = 0;
    if (lastRecord) {
      const match = lastRecord.id.match(/\d+/);
      if (match) maxProdNum = parseInt(match[0], 10);
    }

    // Get last transaction ID once before the loop
    const lastTx = await tx.inventoryTransaction.findFirst({
      where: { id: { startsWith: 'TX' } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    let lastTxNum = 0;
    if (lastTx) {
      const match = lastTx.id.match(/\d+/);
      if (match) lastTxNum = parseInt(match[0], 10);
    }

    for (let i = 0; i < productsList.length; i++) {
      const item = productsList[i];
      maxProdNum++;
      const prodId = `PROD-${String(maxProdNum).padStart(3, '0')}`;

      const bName = brandsMap.get(item.brandId) || '';
      let formattedName = item.name.trim();
      if (bName) {
        const lowerName = formattedName.toLowerCase();
        const lowerBrand = bName.toLowerCase();
        if (!lowerName.startsWith(lowerBrand)) {
          formattedName = `${bName} - ${formattedName}`;
        }
      }

      let itemCodeToSave = item.itemCode ? item.itemCode.trim() : null;
      if (!itemCodeToSave) {
        itemCodeToSave = await generateSkuCode(tx, bName, item.category || 'General');
      }

      // 1. Create Product
      const isSerialized = item.productType !== 'NORMAL' && item.productType !== 'UNIFORM';
      const prod = await tx.product.create({
        data: {
          id: prodId,
          name: formattedName,
          brandId: item.brandId,
          itemCode: itemCodeToSave,
          category: item.category || 'Stands',
          size: item.size || null,
          imageUrl: item.imageUrl || null,
          rack: item.rack || null,
          shelf: item.shelf || null,
          isReturnable: !!item.isReturnable,
          trackExpiry: !!item.trackExpiry,
          isPublic: item.isPublic !== false,
          isSerialized,
          stockCap: item.stockCap ? parseInt(item.stockCap, 10) : null,
        }
      });
      createdProducts.push(prod);

      // 2. Handle multiple initial stock entries
      if (item.inbounds && item.inbounds.length > 0) {
        for (let j = 0; j < item.inbounds.length; j++) {
          const entry = item.inbounds[j];
          if (entry.qty > 0) {
            lastTxNum++;
            const txId = `TX-${String(lastTxNum).padStart(5, '0')}`;
            
            // Generate delivery note using proper format if not provided
            const finalDeliveryNote = (entry.deliveryNote && entry.deliveryNote.trim() && entry.deliveryNote !== 'INITIAL_STOCK')
              ? entry.deliveryNote.trim()
              : await generateCustomRef(tx, 'REC', bName || 'General');
            
            // Log transaction
            await tx.inventoryTransaction.create({
              data: {
                id: txId,
                productId: prodId,
                transactionType: 'RECEIVE',
                fromEntityType: 'SUPPLIER',
                fromEntityId: entry.fromId || 'Initial Import',
                toEntityType: 'WAREHOUSE',
                toEntityId: 'MAIN',
                quantity: entry.qty,
                deliveryNote: finalDeliveryNote,
                notes: entry.notes || 'Auto-received initial stock',
                receivedBy: entry.receivedBy || null,
                manufactureDate: entry.manufactureDate ? new Date(entry.manufactureDate) : null,
                expiryDate: entry.expiryDate ? new Date(entry.expiryDate) : null,
              }
            });

            // 3. Create Serial Numbers if serialized
            if (isSerialized && entry.barcodes) {
              const barcodes = entry.barcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
              if (barcodes.length > 0) {
                const serialData = barcodes.map((barcode) => {
                  const serialId = `SERL-${String(nextSerNum + serialOffset).padStart(5, '0')}`;
                  serialOffset++;
                  return {
                    id: serialId,
                    productId: prodId,
                    barcode,
                    status: 'AVAILABLE',
                    currentLocationType: 'WAREHOUSE',
                    currentLocationId: 'MAIN',
                  };
                });

                await tx.productSerialNumber.createMany({
                  data: serialData,
                });
              }
            }
          }
        }
      }
    }
    return createdProducts;
  }, {
    timeout: 20000
  });

  revalidateProductPaths();
  return results;
}


