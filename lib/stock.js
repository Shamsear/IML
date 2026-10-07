/**
 * Stock Calculation Utilities — Shared client-side stock computation.
 *
 * Used by ReportsClient, BrandPortalClient, BrandDetailClient, and ProductDetailClient
 * to compute comprehensive per-product stock breakdowns from raw transaction data.
 *
 * Adheres to the unified Inventory Movement Matrix:
 *  - purchased: total stock acquired (Receive + Rebrand In - Vendor Returns)
 *  - warehouse: current stock available inside Central Warehouse
 *  - issued: current stock distributed across Retail Stores / Outlets
 *  - used: current stock with Promoters / Staff
 *  - withClient: current stock held in Client / Brand Owner custody
 *  - damage: written-off damaged stock
 *  - lost: written-off missing / lost stock
 *  - reBrand: stock converted out to another product
 *  - total: current warehouse stock
 */

const TYPE_PRIORITY = {
  'INITIAL': 1,
  'INITIAL_STOCK': 1,
  'RECEIVE': 1,
  'REC': 1,
  'REBRAND_IN': 2,
  'REB_IN': 2,
  'REBRAND_OUT': 3,
  'REB_OUT': 3,
  'REBRAND': 3,
  'CLIENT_STOCK': 4,
  'ISSUE': 5,
  'OUT': 5,
  'RETURN': 6,
  'RET': 6,
  'USED': 7,
  'DAMAGE': 8,
  'DAM': 8,
  'LOST': 9,
  'LST': 9,
  'CLIENT_RETURN': 10
};

export function getProductStock(rawTransactions) {
  if (!rawTransactions || rawTransactions.length === 0) {
    return { purchased: 0, warehouse: 0, issued: 0, used: 0, damage: 0, lost: 0, withClient: 0, reBrand: 0, total: 0 };
  }

  // Sort chronologically so stock calculations process events in true historical sequence.
  // When timestamps are identical (e.g. batch imports or same-minute logs), prioritize receipts/issues before returns/usages.
  const transactions = [...rawTransactions].sort((a, b) => {
    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (tA !== tB) return tA - tB;
    const pA = TYPE_PRIORITY[(a.transactionType || '').toUpperCase()] || 50;
    const pB = TYPE_PRIORITY[(b.transactionType || '').toUpperCase()] || 50;
    return pA - pB;
  });

  let purchased = 0;
  let warehouse = 0;
  let issued = 0;      // Stock at Stores / Outlets
  let used = 0;        // Stock with Promoters / Staff
  let withClient = 0;  // Stock with Client / Brand Owner
  let damage = 0;      // Damaged items
  let lost = 0;        // Lost items
  let reBrand = 0;     // Rebranded out items

  transactions.forEach(t => {
    const qty = Number(t.quantity) || 0;
    const type = (t.transactionType || '').toUpperCase();
    const from = (t.fromEntityType || '').toUpperCase();
    const to = (t.toEntityType || '').toUpperCase();
    const dn = (t.deliveryNote || '').toUpperCase();
    const notes = (t.notes || '').toLowerCase();

    // Check if this transaction is an inbound reversion (restoring stock back to original product)
    const isInboundRevert = (type === 'REBRAND_IN' || type === 'REB_IN') && (
      dn.startsWith('REV-') || dn.startsWith('RTR-') || notes.includes('reverted rebrand <-') || notes.includes('returned to source') || reBrand > 0
    );

    // Check if this transaction is an outbound reversion (deducting stock from converted product to give back)
    const isOutboundRevert = (type === 'REBRAND_OUT' || type === 'REB_OUT') && (
      dn.startsWith('REV-') || dn.startsWith('RTR-') || notes.includes('reverted rebrand ->')
    );

    // 1. INBOUND RECEIPTS TO WAREHOUSE
    if (type === 'RECEIVE' || type === 'REC' || type === 'INITIAL' || type === 'INITIAL_STOCK') {
      purchased += qty;
      warehouse += qty;
    }
    // 2. REBRAND IN (Product converted into warehouse, or rebrand cancelled/restored back)
    else if (type === 'REBRAND_IN' || type === 'REB_IN') {
      if (isInboundRevert) {
        // Reverting a previous rebrand: restores stock to warehouse and reduces reBrand out bucket.
        // Crucial: Does NOT add to purchased since original product was already purchased!
        warehouse += qty;
        reBrand = Math.max(0, reBrand - qty);
      } else {
        // Brand new converted product created from rebrand
        purchased += qty;
        warehouse += qty;
      }
    }
    // 3. REBRAND OUT (Old product converted out of warehouse, or cancelling an inbound rebrand)
    else if (type === 'REBRAND_OUT' || type === 'REB_OUT' || type === 'REBRAND') {
      if (isOutboundRevert) {
        // Reverting an inbound rebrand: removes stock from converted warehouse and offsets purchased
        warehouse -= qty;
        purchased = Math.max(0, purchased - qty);
      } else {
        warehouse -= qty;
        reBrand += qty;
      }
    }
    // 4. CLIENT STOCK / DIRECT DISPATCH TO CLIENT
    else if (type === 'CLIENT_STOCK') {
      if (from === 'WAREHOUSE' || !from) {
        warehouse -= qty;
      } else if (from === 'STORE') {
        const fromIssued = Math.min(issued, qty);
        issued -= fromIssued;
        warehouse -= (qty - fromIssued);
      }
      withClient += qty;
    }
    // 5. CLIENT RETURN (Stock returning from Client to Warehouse)
    else if (type === 'CLIENT_RETURN') {
      if (to === 'WAREHOUSE' || !to) {
        warehouse += qty;
        withClient = Math.max(0, withClient - qty);
      } else {
        withClient += qty;
        warehouse -= qty;
      }
    }
    // 6. ISSUE / DISPATCHES
    else if (type === 'ISSUE' || type === 'OUT') {
      if (from === 'WAREHOUSE' || !from) {
        warehouse -= qty;
        if (to === 'STORE') {
          issued += qty;
        } else if (to === 'STAFF') {
          used += qty;
        } else if (to === 'CLIENT' || to === 'BRAND') {
          withClient += qty;
        } else if (to === 'DIRECT') {
          used += qty;
        } else {
          issued += qty; // default dispatch to store
        }
      } else if (from === 'STORE') {
        const fromIssued = Math.min(issued, qty);
        issued -= fromIssued;
        warehouse -= (qty - fromIssued);
        if (to === 'STAFF') {
          used += qty;
        } else if (to === 'CLIENT' || to === 'BRAND') {
          withClient += qty;
        } else {
          used += qty;
        }
      } else if (from === 'STAFF') {
        const fromUsed = Math.min(used, qty);
        used -= fromUsed;
        warehouse -= (qty - fromUsed);
        if (to === 'STORE') {
          issued += qty;
        } else {
          issued += qty;
        }
      } else {
        warehouse -= qty;
        issued += qty;
      }
    }
    // 7. USED ITEMS
    else if (type === 'USED') {
      if (from === 'STORE') {
        const fromIssued = Math.min(issued, qty);
        issued -= fromIssued;
        warehouse -= (qty - fromIssued);
      } else if (from === 'STAFF') {
        const fromUsed = Math.min(used, qty);
        used -= fromUsed;
        warehouse -= (qty - fromUsed);
      } else {
        warehouse -= qty;
      }
      used += qty;
    }
    // 8. RETURNS
    else if (type === 'RETURN' || type === 'RET') {
      if (to === 'VENDOR' || to === 'SUPPLIER') {
        warehouse -= qty;
        purchased = Math.max(0, purchased - qty);
      } else if (to === 'WAREHOUSE' || !to) {
        warehouse += qty;
        if (from === 'CLIENT' || from === 'BRAND') {
          withClient = Math.max(0, withClient - qty);
        } else if (from === 'STAFF') {
          used = Math.max(0, used - qty);
        } else if (from === 'STORE') {
          issued = Math.max(0, issued - qty);
        } else {
          if (issued >= qty) {
            issued -= qty;
          } else if (withClient >= qty) {
            withClient -= qty;
          } else if (used >= qty) {
            used -= qty;
          }
        }
      } else if (to === 'STORE') {
        issued += qty;
        if (from === 'STAFF') {
          used = Math.max(0, used - qty);
        }
      }
    }
    // 9. DAMAGE
    else if (type === 'DAMAGE' || type === 'DAM') {
      if (from === 'STORE') {
        const fromIssued = Math.min(issued, qty);
        issued -= fromIssued;
        warehouse -= (qty - fromIssued);
      } else if (from === 'STAFF') {
        const fromUsed = Math.min(used, qty);
        used -= fromUsed;
        warehouse -= (qty - fromUsed);
      } else if (from === 'CLIENT' || from === 'BRAND') {
        withClient = Math.max(0, withClient - qty);
      } else {
        warehouse -= qty;
      }
      damage += qty;
    }
    // 10. LOST
    else if (type === 'LOST' || type === 'LST') {
      if (from === 'STORE') {
        const fromIssued = Math.min(issued, qty);
        issued -= fromIssued;
        warehouse -= (qty - fromIssued);
      } else if (from === 'STAFF') {
        const fromUsed = Math.min(used, qty);
        used -= fromUsed;
        warehouse -= (qty - fromUsed);
      } else if (from === 'CLIENT' || from === 'BRAND') {
        withClient = Math.max(0, withClient - qty);
      } else {
        warehouse -= qty;
      }
      lost += qty;
    }
  });

  // Clamp any accidental negative bucket balances to 0 and round to whole numbers
  warehouse = Math.round(Math.max(0, warehouse));
  issued = Math.round(Math.max(0, issued));
  used = Math.round(Math.max(0, used));
  withClient = Math.round(Math.max(0, withClient));
  damage = Math.round(Math.max(0, damage));
  lost = Math.round(Math.max(0, lost));
  reBrand = Math.round(Math.max(0, reBrand));
  purchased = Math.round(Math.max(0, purchased));

  // total = warehouse stock (what's available in the warehouse)
  const total = warehouse;

  return { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total };
}
