import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const p = await pool.query(`
    SELECT id, name, "brandId"
    FROM "Product"
    WHERE name ILIKE '%rebrand%'
  `);
  console.log('Products matching rebrand in name:');
  console.table(p.rows);

  const txTypes = await pool.query(`
    SELECT "transactionType", count(*) 
    FROM "InventoryTransaction"
    WHERE "transactionType" LIKE '%REBRAND%'
    GROUP BY "transactionType"
  `);
  console.log('Rebrand transaction counts:');
  console.table(txTypes.rows);

  // Check if any transactions reference products that might be deleted
  for (const prod of p.rows) {
    const txCount = await pool.query(`
      SELECT count(*) FROM "InventoryTransaction" WHERE "productId" = $1
    `, [prod.id]);
    console.log(`Product "${prod.name}" has ${txCount.rows[0].count} total transactions.`);
  }

  await pool.end();
}

run().catch(console.error);
