const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT id, name, category, "trackExpiry", "isSerialized" FROM "Product" WHERE name ILIKE \'%Sadia%\' LIMIT 20');
  console.log('Products:', JSON.stringify(res.rows, null, 2));

  const stores = await pool.query('SELECT id, name FROM "Store" WHERE name ILIKE \'%HOOTH%\'');
  console.log('Stores matching HOOTH:', JSON.stringify(stores.rows, null, 2));

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
