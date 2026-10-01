import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

import { getProductStock } from '../lib/stock.js';

async function run() {
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name
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

  console.log('=== CHECKING ALL PRODUCTS FOR ZERO PURCHASE & NEGATIVE WAREHOUSE / POSITIVE ISSUED ===');

  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);

    if (stock.purchased === 0 && (stock.warehouse < 0 || stock.issued > 0 || stock.used > 0 || stock.damage > 0 || stock.lost > 0 || stock.reBrand > 0)) {
      console.log(`\nProduct: [${p.itemCode}] "${p.name}" (${p.brand_name})`);
      console.log(`Stock:`, stock);
      console.log(`Transactions (${txList.length}):`);
      for (const t of txList) {
        console.log(`  - [${t.transactionType}] qty=${t.quantity} from=${t.fromEntityType}->to=${t.toEntityType} DN=${t.deliveryNote} notes=${t.notes || ''}`);
      }
    }
  }

  // Also let's check any product where warehouse is negative in getProductStock
  console.log('\n=== ALL PRODUCTS WITH WAREHOUSE < 0 IN getProductStock ===');
  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);
    if (stock.warehouse < 0) {
      console.log(`Product: [${p.itemCode}] "${p.name}" (${p.brand_name}) -> Warehouse: ${stock.warehouse}, Purchased: ${stock.purchased}, Issued: ${stock.issued}`);
    }
  }

  await pool.end();
}

run().catch(console.error);
