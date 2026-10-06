import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const res = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'User\'');
  console.log('User Columns:', res.rows.map(r => r.column_name));

  const users = await pool.query('SELECT id, username, name, role, "isActive" FROM "User"');
  console.log('Users:', users.rows);
  await pool.end();
}

run().catch(console.error);
