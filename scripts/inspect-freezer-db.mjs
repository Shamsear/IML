import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: dbUrlMatch[1] });

async function run() {
  const res = await pool.query(`
    SELECT t.id, t."transactionType", t."deliveryNote", t.quantity, t.notes, t.timestamp, p.name as product_name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."deliveryNote" LIKE 'RBD-SAD-250826%' OR p.name ILIKE '%freezer%'
    ORDER BY t.timestamp DESC, t.id DESC
  `);
  console.log('Database records for RBD-SAD-250826 or Freezer:');
  console.table(res.rows);

  await pool.end();
}

run().catch(console.error);
