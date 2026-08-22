/**
 * Stock Calculation Utilities — Shared client-side stock computation.
 *
 * Used by ReportsClient, BrandPortalClient, and BrandDetailClient to compute
 * per-product stock breakdowns from raw transaction data.
 *
 * NOTE: This is a CLIENT-SIDE calculation. For server-side warehouse stock,
 * use computeWarehouseStockMap() from app/actions/products.js instead.
 */

/**
 * Compute the stock breakdown for a product from its raw transactions.
 * Returns: { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total }
 *
 * `total` equals `warehouse` (what's currently available in the warehouse).
 */
export function getProductStock(rawTransactions) {
  const transactions = [...rawTransactions];

  // Synthesize virtual ISSUE transactions for items marked as USED
  // that haven't been physically issued from a store yet
  let totalQtyMarkedUsed = 0;
  transactions.forEach(t => {
    if (t.transactionType === 'ISSUE' && t.fromEntityType !== 'STORE' && t.returnStatus === 'USED') {
      totalQtyMarkedUsed += t.quantity || 0;
    }
  });

  let totalQtyStoreToStaff = 0;
  transactions.forEach(t => {
    if (t.transactionType === 'ISSUE' && t.fromEntityType === 'STORE' && t.toEntityType === 'STAFF') {
      totalQtyStoreToStaff += t.quantity || 0;
    }
  });

  const virtualQty = Math.max(0, totalQtyMarkedUsed - totalQtyStoreToStaff);
  if (virtualQty > 0) {
    transactions.push({
      transactionType: 'ISSUE',
      fromEntityType: 'STORE',
      toEntityType: 'STAFF',
      quantity: virtualQty,
    });
  }

  let purchased = 0;
  let warehouse = 0;
  let issued = 0;
  let used = 0;
  let withClient = 0;
  let damage = 0;
  let lost = 0;
  let reBrand = 0;

  transactions.forEach(t => {
    const qty = t.quantity || 0;
    if (t.transactionType === 'RECEIVE') {
      purchased += qty;
      warehouse += qty;
    } else if (t.transactionType === 'ISSUE') {
      if (t.fromEntityType === 'STORE') {
        issued -= qty;
        if (t.toEntityType === 'STAFF') used += qty;
      } else {
        warehouse -= qty;
        if (t.toEntityType === 'STORE' || t.toEntityType === 'SUPERVISOR') issued += qty;
        else if (t.toEntityType === 'STAFF') used += qty;
        else if (t.toEntityType === 'CLIENT' || t.toEntityType === 'BRAND') withClient += qty;
      }
    } else if (t.transactionType === 'CLIENT_RETURN') {
      warehouse -= qty;
      withClient += qty;
    } else if (t.transactionType === 'RETURN') {
      warehouse += qty;
      if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
      else if (t.fromEntityType === 'STAFF') used -= qty;
      else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
    } else if (t.transactionType === 'DAMAGE') {
      if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
      else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
      else if (t.fromEntityType === 'STAFF') used -= qty;
      else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
      damage += qty;
    } else if (t.transactionType === 'LOST') {
      if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
      else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
      else if (t.fromEntityType === 'STAFF') used -= qty;
      else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
      lost += qty;
    } else if (t.transactionType === 'REBRAND_OUT') {
      warehouse -= qty;
      reBrand += qty;
    } else if (t.transactionType === 'REBRAND_IN') {
      warehouse += qty;
    }
  });

  // total = warehouse stock (what's available in the warehouse)
  const total = warehouse;

  return { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total };
}
