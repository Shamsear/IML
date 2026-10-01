import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

import { getProductStock } from '../lib/stock.js';

async function run() {
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, p.category, p.size, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT id, "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    ORDER BY timestamp ASC
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  const negativeWarehouse = [];
  const negativeIssued = [];
  const zeroPurchasedWithActivity = [];
  const allDiscrepancies = [];

  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);

    const issues = [];
    if (stock.warehouse < 0) {
      issues.push(`Warehouse is negative (${stock.warehouse})`);
      negativeWarehouse.push({ p, stock, txList });
    }
    if (stock.issued < 0) {
      issues.push(`Issued is negative (${stock.issued})`);
      negativeIssued.push({ p, stock, txList });
    }
    if (stock.purchased === 0 && txList.length > 0) {
      issues.push(`Purchased is 0 but has ${txList.length} transactions`);
      zeroPurchasedWithActivity.push({ p, stock, txList });
    }

    if (issues.length > 0) {
      allDiscrepancies.push({
        itemCode: p.itemCode,
        name: p.name,
        brand: p.brand_name,
        issues: issues.join('; '),
        stock,
        txList
      });
    }
  }

  console.log(`\n=======================================================`);
  console.log(`TOTAL PRODUCTS: ${products.rows.length}`);
  console.log(`PRODUCTS WITH DISCREPANCIES / NEGATIVE VALUES: ${allDiscrepancies.length}`);
  console.log(`=======================================================\n`);

  for (const item of allDiscrepancies) {
    console.log(`[${item.itemCode || item.name}] ${item.name} (${item.brand})`);
    console.log(`  Issues: ${item.issues}`);
    console.log(`  Stock breakdown:`, JSON.stringify(item.stock));
    console.log(`  Transactions (${item.txList.length}):`);
    for (const t of item.txList) {
      const dt = new Date(t.timestamp).toISOString().slice(0, 10);
      console.log(`    - [${dt}] [${t.transactionType}] Qty: ${t.quantity} | ${t.fromEntityType || '?'}(${t.fromEntityId || ''}) -> ${t.toEntityType || '?'}(${t.toEntityId || ''}) | DN: ${t.deliveryNote || '-'} | Notes: ${t.notes || ''}`);
    }
    console.log('');
  }

  await pool.end();
}

run().catch(console.error);
