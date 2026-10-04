import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const p1 = await pool.query(`
    SELECT t.id, t."transactionType", t."deliveryNote", t.quantity, t.notes, p.name as product_name
    FROM "InventoryTransaction" t
    LEFT JOIN "Product" p ON t."productId" = p.id
    WHERE t."productId" = 'PROD-SAD-045'
  `);
  console.log('Transactions for PROD-SAD-045:');
  console.table(p1.rows);

  const p2 = await pool.query(`
    SELECT t.id, t."transactionType", t."deliveryNote", t.quantity, t.notes, p.name as product_name
    FROM "InventoryTransaction" t
    LEFT JOIN "Product" p ON t."productId" = p.id
    WHERE t."productId" = 'PROD-SAD-046'
  `);
  console.log('Transactions for PROD-SAD-046:');
  console.table(p2.rows);

  await pool.end();
}

run().catch(console.error);
