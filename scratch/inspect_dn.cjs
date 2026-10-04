const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT * FROM "InventoryTransaction" WHERE "deliveryNote" = $1', ['RET-SAD-041026-007']);
  console.log('Transaction rows:', JSON.stringify(res.rows, null, 2));

  if (res.rows.length > 0) {
    const row = res.rows[0];
    if (row.fromEntityId) {
      const storeRes = await pool.query('SELECT * FROM "Store" WHERE id = $1', [row.fromEntityId]);
      console.log('From Store by ID:', storeRes.rows);
    }
    if (row.deliverySupervisorId) {
      const supRes = await pool.query('SELECT * FROM "Supervisor" WHERE id = $1', [row.deliverySupervisorId]);
      console.log('Supervisor by ID:', supRes.rows);
    }
  }

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
