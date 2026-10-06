import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query('SELECT id, name, "itemCode", "imageUrl" FROM "Product"');
  const products = res.rows;
  console.log('Total products in database:', products.length);
  const withImg = products.filter(p => p.imageUrl && p.imageUrl.trim() !== '');
  console.log('Products with imageUrl:', withImg.length);
  console.log('Products without imageUrl (null or empty):', products.length - withImg.length);
  
  console.log('\n--- Sample Products with Image ---');
  console.log(withImg.slice(0, 8));

  console.log('\n--- Sample Products without Image ---');
  console.log(products.filter(p => !p.imageUrl || p.imageUrl.trim() === '').slice(0, 10));

  const ikImages = withImg.filter(p => p.imageUrl.includes('ik.imagekit.io'));
  const localImages = withImg.filter(p => p.imageUrl.startsWith('/uploads/'));
  const otherImages = withImg.filter(p => !p.imageUrl.includes('ik.imagekit.io') && !p.imageUrl.startsWith('/uploads/'));
  console.log('\n--- Image URL Breakdown ---');
  console.log('ImageKit URLs:', ikImages.length);
  console.log('Local /uploads/ URLs:', localImages.length);
  console.log('Other URLs:', otherImages.length);

  // Check what transactions / ledgers use
  const txRes = await pool.query('SELECT count(distinct "productId") as distinct_tx_products FROM "Transaction"');
  console.log('\nDistinct products in Transactions:', txRes.rows[0].distinct_tx_products);

  // How many distinct products in transactions lack an image?
  const txWithoutImg = await pool.query(`
    SELECT count(distinct t."productId") 
    FROM "Transaction" t 
    JOIN "Product" p ON t."productId" = p.id 
    WHERE p."imageUrl" IS NULL OR p."imageUrl" = ''
  `);
  console.log('Distinct products in Transactions WITHOUT image:', txWithoutImg.rows[0].count);

  const txWithImg = await pool.query(`
    SELECT count(distinct t."productId") 
    FROM "Transaction" t 
    JOIN "Product" p ON t."productId" = p.id 
    WHERE p."imageUrl" IS NOT NULL AND p."imageUrl" != ''
  `);
  console.log('Distinct products in Transactions WITH image:', txWithImg.rows[0].count);
}
run().catch(console.error).finally(() => pool.end());
