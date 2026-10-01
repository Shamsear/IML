import fs from 'fs';
import pg from 'pg';
import { getProductStock } from '../lib/stock.js';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const p = await pool.query(`
    SELECT id, "itemCode", name FROM "Product" WHERE "itemCode" = 'PROD-SAD-095'
  `);
  console.log('Product:', p.rows[0]);

  const txs = await pool.query(`
    SELECT id, "transactionType", quantity, "fromEntityType", "toEntityType", "deliveryNote", timestamp
    FROM "InventoryTransaction"
    WHERE "productId" = $1
    ORDER BY timestamp ASC
  `, [p.rows[0].id]);

  console.log('Tx count:', txs.rows.length);
  const stock = getProductStock(txs.rows);
  console.log('Stock computed by lib/stock.js:', stock);

  // Group by type
  const byType = {};
  for (const t of txs.rows) {
    byType[t.transactionType] = (byType[t.transactionType] || 0) + Number(t.quantity);
  }
  console.log('By Type sum:', byType);

  await pool.end();
}
run().catch(console.error);
