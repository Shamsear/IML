import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

import { getProductStock } from '../lib/stock.js';

async function run() {
  const p = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    WHERE p."itemCode" = 'PROD-SAD-040'
  `);

  const txRes = await pool.query(`
    SELECT id, "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    WHERE "productId" = $1
    ORDER BY timestamp ASC
  `, [p.rows[0].id]);

  console.log(`Product:`, p.rows[0]);
  console.log(`Transactions:`, txRes.rows);
  console.log(`Calculated Stock:`, getProductStock(txRes.rows));

  await pool.end();
}

run().catch(console.error);
