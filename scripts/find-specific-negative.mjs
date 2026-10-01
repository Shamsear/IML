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
    ORDER BY p.name ASC
  `);

  const allTx = await pool.query(`
    SELECT "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    ORDER BY timestamp ASC
  `);

  const txByProduct = new Map();
  for (const t of allTx.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  console.log('Searching for any products with negative stock in getProductStock:');

  const negativeMatches = [];

  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);

    if (stock.warehouse < 0 || stock.issued < 0 || stock.purchased < 0 || (stock.purchased === 0 && stock.issued > 0)) {
      negativeMatches.push({
        id: p.id,
        itemCode: p.itemCode,
        name: p.name,
        brand: p.brand_name,
        stock,
        txList
      });
    }
  }

  console.log(`Found ${negativeMatches.length} products:\n`);
  for (const m of negativeMatches) {
    console.log(`----------------------------------------------------------------`);
    console.log(`Product: [${m.itemCode || m.id}] ${m.name} (${m.brand})`);
    console.log(`Stock:`, JSON.stringify(m.stock, null, 2));
    console.log(`Transactions:`);
    for (const t of m.txList) {
      console.log(`  - [${t.transactionType}] qty=${t.quantity} from=${t.fromEntityType}(${t.fromEntityId}) to=${t.toEntityType}(${t.toEntityId}) DN=${t.deliveryNote}`);
    }
  }

  await pool.end();
}

run().catch(console.error);
