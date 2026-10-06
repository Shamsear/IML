import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
    SELECT t.id, t."transactionType", t."fromEntityType", t."fromEntityId", t."toEntityType", t."toEntityId", t.quantity, t."deliveryNote", t.timestamp, t.notes, p."brandId", b.name as "brandName"
    FROM "InventoryTransaction" t
    LEFT JOIN "Product" p ON t."productId" = p.id
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    WHERE t."deliveryNote" ILIKE '%RET-SAD-061026-024%' OR t.id = '683bf281-79fe-4482-a2f2-e305f8d118e8'
  `);
  console.log("Tx details:", res.rows);

  const outbound = await pool.query(`
    SELECT t.id, t."transactionType", t."fromEntityType", t."fromEntityId", t."toEntityType", t."toEntityId", t.quantity, t."deliveryNote", t.notes
    FROM "InventoryTransaction" t
    WHERE t.id ILIKE '%000387%' OR t."deliveryNote" ILIKE '%000387%'
  `);
  console.log("Outbound details:", outbound.rows);

  await pool.end();
}

run().catch(console.error);
