const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const staff = await pool.query(`
    SELECT s.*, st.name as store_name FROM "Staff" s LEFT JOIN "Store" st ON s."storeId" = st.id
  `);
  console.log('All Staff:', staff.rows);

  const allocs = await pool.query(`
    SELECT a.*, s.name as staff_name, s.phone as staff_phone, s."shirtSize" as staff_size, st.name as store_name
    FROM "StaffUniformAllocation" a
    LEFT JOIN "Staff" s ON a."staffId" = s.id
    LEFT JOIN "Store" st ON a."storeId" = st.id
  `);
  console.log('All Allocations:', allocs.rows);

  await pool.end();
}

run().catch(console.error);
