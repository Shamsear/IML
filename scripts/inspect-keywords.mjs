import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const p = await pool.query(`
    SELECT id, name
    FROM "Product"
    WHERE name ILIKE '%look%' OR name ILIKE '%c4%' OR name ILIKE '%aed%' OR name ILIKE '%ramadan%'
  `);
  console.log('Products matching keywords:');
  console.table(p.rows);

  await pool.end();
}

run().catch(console.error);
