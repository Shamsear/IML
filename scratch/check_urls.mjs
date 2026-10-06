import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query('SELECT id, name, "itemCode", "imageUrl" FROM "Product" WHERE "imageUrl" IS NOT NULL');
  console.log(`Testing HTTP status for ${res.rows.length} product images...`);
  
  let okCount = 0;
  let failCount = 0;
  const failed = [];

  for (const p of res.rows) {
    try {
      const response = await fetch(p.imageUrl, { method: 'HEAD' });
      if (response.ok) {
        okCount++;
      } else {
        failCount++;
        failed.push({ id: p.id, name: p.name, url: p.imageUrl, status: response.status });
      }
    } catch (e) {
      failCount++;
      failed.push({ id: p.id, name: p.name, url: p.imageUrl, error: e.message });
    }
  }

  console.log(`\nResults: ${okCount} OK, ${failCount} FAILED.`);
  if (failed.length > 0) {
    console.log('Failed images:', failed);
  }

  // Also check top 15 most frequent products in transactions
  const txTop = await pool.query(`
    SELECT p.id, p.name, p."imageUrl", COUNT(t.id) as tx_count
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    GROUP BY p.id, p.name, p."imageUrl"
    ORDER BY tx_count DESC
    LIMIT 15
  `);
  console.log('\nTop 15 most frequent products in transactions:');
  console.table(txTop.rows);

  // Check how many transactions belong to products without image
  const nullImgTx = await pool.query(`
    SELECT count(t.id) as count
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE p."imageUrl" IS NULL OR p."imageUrl" = ''
  `);
  console.log('\nTotal transactions with products that have NO image:', nullImgTx.rows[0].count);
}
run().catch(console.error).finally(() => pool.end());
