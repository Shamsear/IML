const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const brand = await pool.query('SELECT id, name FROM "Brand" WHERE id = \'BRND-SADIA\'');
  console.log('Brand BRND-SADIA:', JSON.stringify(brand.rows, null, 2));

  const allBrands = await pool.query('SELECT id, name FROM "Brand"');
  console.log('All Brands:', JSON.stringify(allBrands.rows, null, 2));

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
