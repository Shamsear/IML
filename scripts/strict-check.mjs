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
    WHERE p."itemCode" IN ('PROD-SAD-023', 'PROD-SAD-035', 'PROD-SAD-008', 'PROD-SAD-021', 'PROD-SAD-045', 'PROD-SAD-090', 'PROD-SAD-103', 'PROD-SAD-116')
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

  console.log('=== PRODUCT DETAILS FOR NOTABLE PRODUCTS ===');
  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);
    console.log(`[${p.itemCode}] "${p.name}"`);
    console.log(`  Stock Breakdown:`, stock);
    console.log(`  Recent Tx count: ${txList.length}`);
  }

  // Also check if ANY product across all 117 products has ANY negative number:
  const allProducts = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
  `);

  const anyNegative = [];
  for (const p of allProducts.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);
    for (const [key, val] of Object.entries(stock)) {
      if (typeof val === 'number' && val < 0) {
        anyNegative.push({ itemCode: p.itemCode, name: p.name, field: key, value: val });
      }
    }
  }

  console.log(`\n=== STRICT CHECK: ALL PRODUCTS ACROSS DATABASE WITH ANY NEGATIVE VALUE: ${anyNegative.length} ===`);
  if (anyNegative.length > 0) {
    console.table(anyNegative);
  } else {
    console.log('✅ Zero negative values found across all 117 products!');
  }

  await pool.end();
}

run().catch(console.error);
