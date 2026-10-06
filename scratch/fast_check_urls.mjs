import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUrl(p) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(p.imageUrl, { method: 'GET', signal: controller.signal, headers: { 'Range': 'bytes=0-10' } });
    clearTimeout(timeout);
    return { id: p.id, name: p.name, url: p.imageUrl, ok: res.ok, status: res.status };
  } catch (err) {
    clearTimeout(timeout);
    return { id: p.id, name: p.name, url: p.imageUrl, ok: false, error: err.message };
  }
}

async function run() {
  const res = await pool.query('SELECT id, name, "itemCode", "imageUrl" FROM "Product" WHERE "imageUrl" IS NOT NULL');
  console.log(`Checking ${res.rows.length} URLs in parallel batches...`);
  
  const results = await Promise.all(res.rows.map(p => checkUrl(p)));
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  
  console.log(`\nResults: ${ok.length} OK, ${fail.length} FAILED.`);
  if (fail.length > 0) {
    console.log('\nFailed Image URLs:');
    console.table(fail);
  }

  // Also query transaction frequencies
  const txTop = await pool.query(`
    SELECT p.id, p.name, p."imageUrl", COUNT(t.id) as tx_count
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    GROUP BY p.id, p.name, p."imageUrl"
    ORDER BY tx_count DESC
    LIMIT 20
  `);
  console.log('\nTop 20 most frequent products in transactions:');
  console.table(txTop.rows);

  // Check how many transactions belong to products without image or with failed image
  const nullImgTx = await pool.query(`
    SELECT count(t.id) as count
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE p."imageUrl" IS NULL OR p."imageUrl" = ''
  `);
  console.log('\nTotal transactions with products having NO image URL in DB:', nullImgTx.rows[0].count);
}

run().catch(console.error).finally(() => pool.end());
