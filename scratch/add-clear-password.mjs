import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  console.log('Adding clearPassword column to User table...');
  await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clearPassword" TEXT;');
  
  // Update viewer clearPassword if known
  await pool.query('UPDATE "User" SET "clearPassword" = \'Viewer@1234\' WHERE username = \'viewer\' AND "clearPassword" IS NULL;');
  
  const res = await pool.query('SELECT id, username, name, role, "clearPassword" FROM "User"');
  console.log('Updated Users:', res.rows);
  await pool.end();
}

run().catch(console.error);
