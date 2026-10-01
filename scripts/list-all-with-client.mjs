import fs from 'fs';
import pg from 'pg';
import { getProductStock } from '../lib/stock.js';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, p.category
    FROM "Product" p
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT "productId", "transactionType", quantity, "toEntityType", "returnStatus"
    FROM "InventoryTransaction"
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  const list = [];
  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);
    if (stock.withClient > 0) {
      list.push({
        code: p.itemCode,
        name: p.name,
        category: p.category,
        withClientQty: stock.withClient,
        warehouseQty: stock.warehouse,
        purchasedQty: stock.purchased,
      });
    }
  }

  console.log(`\nTotal products with client stock: ${list.length}`);
  console.table(list);

  await pool.end();
}

run().catch(console.error);
