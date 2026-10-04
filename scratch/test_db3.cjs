const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const supervisors = await pool.query('SELECT id, name FROM "Supervisor" WHERE name ILIKE \'%Vineeth%\'');
  console.log('Supervisors matching Vineeth:', JSON.stringify(supervisors.rows, null, 2));

  const allSupervisors = await pool.query('SELECT id, name FROM "Supervisor" LIMIT 10');
  console.log('Sample Supervisors:', JSON.stringify(allSupervisors.rows, null, 2));

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
