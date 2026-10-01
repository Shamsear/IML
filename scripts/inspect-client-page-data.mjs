import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const res = await pool.query(`
    SELECT "transactionType", count(*)
    FROM "InventoryTransaction"
    WHERE "transactionType" IN ('CLIENT_STOCK', 'CLIENT_RETURN')
       OR "toEntityType" IN ('CLIENT', 'BRAND')
       OR "fromEntityType" IN ('CLIENT', 'BRAND')
    GROUP BY "transactionType"
  `);
  console.table(res.rows);

  const txs = await pool.query(`
    SELECT t.id, t."transactionType", t.quantity, t."fromEntityType", t."toEntityType", t."deliveryNote", p.name, p."itemCode"
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" IN ('CLIENT_STOCK', 'CLIENT_RETURN')
       OR t."toEntityType" IN ('CLIENT', 'BRAND')
       OR t."fromEntityType" IN ('CLIENT', 'BRAND')
    ORDER BY t.timestamp DESC
    LIMIT 20
  `);
  console.log('\nSample transactions:');
  console.table(txs.rows);

  await pool.end();
}

run().catch(console.error);
