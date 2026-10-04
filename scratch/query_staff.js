const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const storeAllocs = await pool.query(`
    SELECT a.*, s.name as staff_name, s.phone as staff_phone, s."shirtSize" as staff_size
    FROM "StaffUniformAllocation" a
    LEFT JOIN "Staff" s ON a."staffId" = s.id
    WHERE a."storeId" = 'STR-SAD-0152' OR a.ref = 'IML-SADIA-DEL-26-08-2026-1391' OR a.ref LIKE '%1391%'
  `);
  console.log('Store Allocations for STR-SAD-0152 or DN 1391:');
  console.log(storeAllocs.rows);

  const staff = await pool.query(`
    SELECT s.* FROM "Staff" s WHERE s."storeId" = 'STR-SAD-0152'
  `);
  console.log('Staff assigned to STR-SAD-0152:');
  console.log(staff.rows);

  await pool.end();
}

run().catch(console.error);
