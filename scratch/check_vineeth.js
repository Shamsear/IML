const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const supervisors = await pool.query(`SELECT * FROM "Supervisor" WHERE name ILIKE '%Vineeth%' OR id = 'SUP-SAD-057'`);
  console.log('Supervisors matching Vineeth or SUP-SAD-057:', supervisors.rows);

  const staff = await pool.query(`SELECT * FROM "Staff" WHERE name ILIKE '%Vineeth%'`);
  console.log('Staff matching Vineeth:', staff.rows);

  const allStaff = await pool.query(`SELECT * FROM "Staff" LIMIT 10`);
  console.log('Sample Staff:', allStaff.rows);

  await pool.end();
}

run().catch(console.error);
