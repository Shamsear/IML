import fs from 'fs';
import path from 'path';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function main() {
  const regions = await pool.query(`
    SELECT COALESCE(region, 'Unspecified') as region, COUNT(*) as count 
    FROM "Store" 
    GROUP BY region 
    ORDER BY count DESC
  `);
  console.log('=== STORES BY REGION IN DATABASE ===');
  console.table(regions.rows);

  const abudhabiStores = await pool.query(`
    SELECT s.id, s.name, s.region,
           (SELECT COUNT(*) FROM "InventoryTransaction" t WHERE t."toEntityId" = s.id) as tx_to_count,
           (SELECT COALESCE(SUM(t.quantity), 0) FROM "InventoryTransaction" t WHERE t."toEntityId" = s.id) as total_qty_issued_to
    FROM "Store" s 
    WHERE LOWER(s.name) LIKE '%abu%' 
       OR LOWER(s.name) LIKE '%dhabi%' 
       OR LOWER(s.name) LIKE '%auh%' 
       OR LOWER(COALESCE(s.region, '')) LIKE '%abu%'
    ORDER BY s.name ASC
  `);
  console.log('\n=== ABU DHABI RELATED STORES IN DATABASE (' + abudhabiStores.rows.length + ') ===');
  console.table(abudhabiStores.rows);

  // Check people/generic names stored as stores
  const genericStores = await pool.query(`
    SELECT id, name, region
    FROM "Store"
    WHERE id IN ('STR-SAD-0022', 'STR-SAD-0023', 'STR-SAD-0024', 'STR-SAD-0025', 'STR-SAD-0027', 'STR-SAD-0032', 'STR-SAD-0054', 'STR-SAD-0070', 'STR-SAD-0072')
  `);
  console.log('\n=== GENERIC / NON-RETAIL ENTITIES IN STORE TABLE ===');
  console.table(genericStores.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
