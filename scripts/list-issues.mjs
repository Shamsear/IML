import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const res = await pool.query(`
    SELECT t.id, t."productId", p."itemCode", p.name as product_name, b.name as brand_name,
           t."transactionType", t.quantity, t."fromEntityType", t."toEntityType", t."deliveryNote", t.notes, t.timestamp
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    WHERE t."transactionType" = 'ISSUE'
    ORDER BY t.timestamp DESC
  `);

  console.log(`Total ISSUE transactions: ${res.rows.length}`);
  for (const r of res.rows) {
    console.log(`[${r.itemCode}] "${r.product_name}" (${r.brand_name}) | Qty: ${r.quantity} | From: ${r.fromEntityType} -> To: ${r.toEntityType} | DN: ${r.deliveryNote}`);
  }

  await pool.end();
}

run().catch(console.error);
