import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const prods = await pool.query(`
    SELECT id, "itemCode", name, category FROM "Product" WHERE "itemCode" IN ('PROD-SAD-088', 'PROD-SAD-114')
  `);
  console.log('Products:', prods.rows);

  const txs = await pool.query(`
    SELECT t.id, p."itemCode", p.name, t."transactionType", t.quantity, t."fromEntityType", t."toEntityType", t."deliveryNote", t.notes, t.timestamp
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE p."itemCode" IN ('PROD-SAD-088', 'PROD-SAD-114')
    ORDER BY p."itemCode", t.timestamp ASC
  `);
  console.log('\nTransactions:');
  console.table(txs.rows);

  await pool.end();
}

run().catch(console.error);
