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
    const qty = Number(t.quantity) || 0;
    const type = t.transactionType;

    if (type === 'RECEIVE' || type === 'REC' || type === 'INITIAL') {
      purchased += qty;
      warehouse += qty;
    } else if (type === 'ISSUE' || type === 'OUT') {
      warehouse -= qty;
      issued += qty;
    } else if (type === 'USED') {
      used += qty;
      warehouse -= qty;
    } else if (type === 'CLIENT_STOCK' || type === 'CLIENT_RETURN') {
      warehouse -= qty;
      withClient += qty;
    } else if (type === 'RETURN' || type === 'RET') {
      if (t.toEntityType === 'VENDOR') {
        warehouse -= qty;
        purchased -= qty;
      } else {
        warehouse += qty;
        if (issued >= qty) issued -= qty;
      }
    } else if (type === 'DAMAGE' || type === 'DAM') {
      warehouse -= qty;
      damage += qty;
    } else if (type === 'LOST' || type === 'LST') {
      warehouse -= qty;
      lost += qty;
    } else if (type === 'REBRAND' || type === 'REBRAND_OUT' || type === 'REB_OUT') {
      warehouse -= qty;
      reBrand += qty;
    } else if (type === 'REBRAND_IN' || type === 'REB_IN') {
      warehouse += qty;
    }
  });

  // total = warehouse stock (what's available in the warehouse)
  const total = warehouse;

  return { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total };
}
