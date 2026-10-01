import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function main() {
  const users = await pool.query('SELECT id, username, name, role, password, "isActive" FROM "User"');
  for (const u of users.rows) {
    const isMatch = await bcrypt.compare('TestAdmin@1234', u.password);
    console.log(`User: ${u.username}, isActive: ${u.isActive}, role: ${u.role}, matches TestAdmin@1234: ${isMatch}`);
  }
  await pool.end();
}

main().catch(console.error);
