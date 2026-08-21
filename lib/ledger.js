/**
 * Ledger Engine — Centralized inventory transaction helpers.
 *
 * Provides:
 *  - Atomic sequential ID generation (inside a Prisma tx client)
 *  - Stock-level calculations
 *  - Serial number validation, status transitions, and linking
 *  - SKU code generation with in-memory prefix caching
 *  - Custom delivery-note reference generation
 *  - UAE timezone date parsing
 */

import { prisma } from './prisma';

// ─── ID Generation (atomic inside transaction) ───────────────────────────────

/**
 * Generate a sequential ID like "TRAN-00001" inside an existing Prisma transaction.
 * Uses a single query + in-memory increment — safe within a $transaction block.
 *
 * @param {object} tx - Prisma transaction client
 * @param {string} model - Prisma model name (camelCase)
 * @param {string} prefix - e.g. "TRAN", "PROD", "STAF"
 * @param {number} padding - zero-padding width (default 5)
 * @returns {Promise<string>}
 */
export async function generateTxId(tx, model, prefix, padding = 5) {
  const last = await tx[model].findFirst({
    where: { id: { startsWith: `${prefix}-` } },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  let nextNum = 1;
  if (last) {
    const parts = last.id.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) nextNum = num + 1;
  }

  return `${prefix}-${String(nextNum).padStart(padding, '0')}`;
}

/**
 * Generate a sequential ID outside a transaction (uses global prisma client).
 * Suitable for non-transactional creates (brands, stores, supervisors).
 */
export async function generateGlobalId(model, prefix, padding = 3) {
  const records = await prisma[model].findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const parts = r.id.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  return `${prefix}-${String(maxNum + 1).padStart(padding, '0')}`;
}

// ─── Stock Calculations ──────────────────────────────────────────────────────

/**
 * Calculate net stock for a single product at a location.
 * Returns (inbound - outbound) quantity.
 */
export async function getStockAtLocation(productId, entityType, entityId) {
  const [inbound, outbound] = await Promise.all([
    prisma.inventoryTransaction.aggregate({
      where: {
        productId,
        toEntityType: entityType,
        ...(entityType === 'WAREHOUSE' ? {} : { toEntityId: entityId || null }),
      },
      _sum: { quantity: true },
    }),
    prisma.inventoryTransaction.aggregate({
      where: {
        productId,
        fromEntityType: entityType,
        ...(entityType === 'WAREHOUSE' ? {} : { fromEntityId: entityId || null }),
      },
      _sum: { quantity: true },
    }),
  ]);

  return (inbound._sum.quantity || 0) - (outbound._sum.quantity || 0);
}

/**
 * Batch stock check — returns a Map<productId, currentStock> for multiple products.
 * Much faster than calling getStockAtLocation in a loop.
 */
export async function batchGetStock(productIds, entityType, entityId) {
  if (productIds.length === 0) return new Map();

  const whereBase =
    entityType === 'WAREHOUSE' ? {} : { toEntityId: entityId || null };
  const whereFrom =
    entityType === 'WAREHOUSE' ? {} : { fromEntityId: entityId || null };

  const [inboundSums, outboundSums] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        toEntityType: entityType,
        ...whereBase,
      },
      _sum: { quantity: true },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        fromEntityType: entityType,
        ...whereFrom,
      },
      _sum: { quantity: true },
    }),
  ]);

  const stockMap = new Map();
  for (const s of inboundSums) {
    stockMap.set(s.productId, s._sum.quantity || 0);
  }
  for (const s of outboundSums) {
    const cur = stockMap.get(s.productId) || 0;
    stockMap.set(s.productId, cur - (s._sum.quantity || 0));
  }

  // Ensure all requested IDs have an entry
  for (const id of productIds) {
    if (!stockMap.has(id)) stockMap.set(id, 0);
  }

  return stockMap;
}

/**
 * Verify stock and throw if insufficient. Returns the current stock value.
 */
export async function assertStock(productId, entityType, entityId, quantity, productName) {
  const stock = await getStockAtLocation(productId, entityType, entityId);
  if (stock < quantity) {
    throw new Error(
      `Insufficient stock for "${productName || productId}". Current stock at ${entityType} is ${stock}, requested ${quantity}.`
    );
  }
  return stock;
}

// ─── Serial Number Validation ────────────────────────────────────────────────

/**
 * Validate a batch of serial barcodes against the database.
 * Returns the validated serial records.
 *
 * Checks:
 *  1. All barcodes exist in the database
 *  2. All barcodes belong to the expected product
 *  3. All barcodes are at the expected source location (if fromEntityType provided)
 *  4. For outbound types (ISSUE/DAMAGE/LOST), validates serials haven't moved
 *
 * @param {object} tx - Prisma transaction client
 * @param {string[]} barcodes
 * @param {string} productId
 * @param {object} options - { fromEntityType, fromEntityId, direction: 'outbound'|'inbound' }
 * @returns {Promise<object[]>} validated serial records
 */
export async function validateSerials(tx, barcodes, productId, options = {}) {
  if (!barcodes || barcodes.length === 0) return [];

  const { fromEntityType, fromEntityId, direction = 'outbound' } = options;

  const dbSerials = await tx.productSerialNumber.findMany({
    where: { barcode: { in: barcodes } },
    include: { product: { select: { name: true } } },
  });

  // Check all barcodes exist
  const foundBarcodes = new Set(dbSerials.map((s) => s.barcode));
  const missing = barcodes.filter((b) => !foundBarcodes.has(b));
  if (missing.length > 0) {
    throw new Error(
      `Barcodes not found in database: ${missing.join(', ')}`
    );
  }

  // Check all barcodes belong to the correct product
  const mismatched = dbSerials.filter((s) => s.productId !== productId);
  if (mismatched.length > 0) {
    const details = mismatched
      .map((s) => `"${s.barcode}" (belongs to "${s.product.name}")`)
      .join(', ');
    throw new Error(`Some barcodes belong to different products: ${details}`);
  }

  // Check location for outbound movements
  if (direction === 'outbound' && fromEntityType) {
    const invalid = dbSerials.filter(
      (s) =>
        s.currentLocationType !== fromEntityType ||
        s.currentLocationId !== (fromEntityId || null)
    );
    if (invalid.length > 0) {
      throw new Error(
        `Some barcodes are not present at the source location (${fromEntityType}).`
      );
    }
  }

  // Check inbound barcodes don't already exist
  if (direction === 'inbound') {
    const duplicates = dbSerials.filter((s) => s.productId === productId);
    if (duplicates.length > 0) {
      const dupes = duplicates
        .map((s) => `"${s.barcode}" (linked to "${s.product.name}")`)
        .join(', ');
      throw new Error(`Some barcodes already exist: ${dupes}`);
    }
  }

  return dbSerials;
}

/**
 * Compute the next serial status based on transaction type and destination.
 */
export function computeSerialStatus(transactionType, toEntityType) {
  if (transactionType === 'DAMAGE') return 'DAMAGED';
  if (transactionType === 'LOST') return 'LOST';
  if (
    toEntityType === 'CLIENT' ||
    toEntityType === 'STAFF' ||
    toEntityType === 'DIRECT'
  ) {
    return 'USED';
  }
  return 'AVAILABLE';
}

/**
 * Bulk update serial status and location.
 * Returns the count of updated records.
 */
export async function bulkUpdateSerials(tx, serialIds, status, locationType, locationId) {
  if (serialIds.length === 0) return 0;

  await tx.productSerialNumber.updateMany({
    where: { id: { in: serialIds } },
    data: {
      currentLocationType: locationType || null,
      currentLocationId: locationId || null,
      status,
    },
  });

  return serialIds.length;
}

/**
 * Link serial numbers to a transaction (bulk create TransactionSerialNumber rows).
 */
export async function linkSerialsToTransaction(tx, transactionId, serialIds) {
  if (serialIds.length === 0) return;

  await tx.transactionSerialNumber.createMany({
    data: serialIds.map((serialNumberId) => ({
      transactionId,
      serialNumberId,
    })),
  });
}

/**
 * Full serial pipeline: validate → compute status → update location → link to transaction.
 * Returns the serial records that were updated.
 *
 * @param {object} tx - Prisma transaction client
 * @param {string[]} barcodes
 * @param {string} productId
 * @param {string} transactionType
 * @param {object} location - { entityType, entityId }
 * @param {string} transactionId
 * @param {object} [options] - { fromEntityType, fromEntityId, direction }
 */
export async function processSerials(
  tx,
  barcodes,
  productId,
  transactionType,
  location,
  transactionId,
  options = {}
) {
  if (!barcodes || barcodes.length === 0) return [];

  const validated = await validateSerials(tx, barcodes, productId, {
    fromEntityType: options.fromEntityType,
    fromEntityId: options.fromEntityId,
    direction: options.direction || 'outbound',
  });

  const serialIds = validated.map((s) => s.id);
  const status = computeSerialStatus(transactionType, location?.entityType);

  await bulkUpdateSerials(tx, serialIds, status, location?.entityType, location?.entityId);
  await linkSerialsToTransaction(tx, transactionId, serialIds);

  return validated;
}

// ─── SKU Code Generation ─────────────────────────────────────────────────────

/**
 * Generate a SKU code with prefix caching on the transaction client.
 * e.g. "SAD-SIM-0001"
 *
 * @param {object} tx - Prisma transaction client (or prisma for non-tx use)
 * @param {string} brandName
 * @param {string} categoryName
 */
export async function generateSkuCode(tx, brandName, categoryName) {
  const brandPrefix = (brandName || 'GEN').substring(0, 3).toUpperCase();
  const catPrefix = (categoryName || 'GEN').substring(0, 3).toUpperCase();
  const prefix = `${brandPrefix}-${catPrefix}`;

  if (!tx.prefixCache) tx.prefixCache = {};
  if (tx.prefixCache[prefix] === undefined) {
    const existing = await tx.product.findMany({
      where: { itemCode: { startsWith: `${prefix}-` } },
      select: { itemCode: true },
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

// ─── Custom Reference / Delivery Note Generation ─────────────────────────────

/**
 * Generate a custom reference code for delivery notes.
 * Format: TYPE-BRD-DDMMYY-NNN e.g. REC-SAD-200826-001
 */
export async function generateCustomRef(tx, type, brandName, customDate = null) {
  const cleanBrand =
    brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'GEN';
  const typeCode = type.toUpperCase();

  const dateObj = customDate ? new Date(customDate) : new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;

  const prefix = `${typeCode}-${cleanBrand}-${dateStr}-`;

  const existing = await tx.inventoryTransaction.findMany({
    where: { deliveryNote: { startsWith: prefix } },
    select: { deliveryNote: true },
    distinct: ['deliveryNote'],
  });

  const nextNum = existing.length + 1;
  const suffix = String(nextNum).padStart(3, '0');
  return `${prefix}${suffix}`;
}

// ─── Date Parsing (UAE UTC+4) ────────────────────────────────────────────────

/**
 * Parse a transaction date string, defaulting to UAE timezone (UTC+4).
 */
export function parseTransactionDate(dateStr) {
  if (!dateStr) return undefined;
  if (typeof dateStr !== 'string') return new Date(dateStr);

  if (
    dateStr.includes('T') &&
    !dateStr.includes('Z') &&
    !dateStr.match(/[+-]\d{2}:\d{2}$/)
  ) {
    const hasSeconds = (dateStr.match(/:/g) || []).length > 1;
    return new Date(dateStr + (hasSeconds ? '' : ':00') + '+04:00');
  }

  if (dateStr.includes('T') || dateStr.includes(':')) {
    return new Date(dateStr);
  }

  return new Date(dateStr + 'T12:00:00+04:00');
}

// ─── Notes Merging ───────────────────────────────────────────────────────────

/**
 * Merge global and per-item notes with a pipe separator.
 */
export function mergeNotes(itemNote, globalNote, includeGlobal = false) {
  const item = itemNote?.trim() || '';
  const global = includeGlobal ? (globalNote?.trim() || '') : '';
  if (global && item) return `${global} | ${item}`;
  return global || item || null;
}
