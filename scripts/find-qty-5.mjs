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
    WHERE t.quantity = 5
    ORDER BY t.timestamp DESC
  `);
  console.log(`Found ${res.rows.length} transactions with quantity 5:`);
  console.table(res.rows.slice(0, 20).map(r => ({
    itemCode: r.itemCode,
    product: r.product_name,
    brand: r.brand_name,
    type: r.transactionType,
    from: r.fromEntityType,
    to: r.toEntityType,
    dn: r.deliveryNote,
    date: new Date(r.timestamp).toISOString().slice(0, 10)
  })));

  await pool.end();
}

run().catch(console.error);
