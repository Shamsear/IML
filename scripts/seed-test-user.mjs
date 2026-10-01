import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function seedTestUser() {
  console.log('Ensuring test_admin user exists...');
  const hashedPassword = await bcrypt.hash('TestAdmin@1234', 10);
  
  const existing = await pool.query('SELECT id FROM "User" WHERE username = $1', ['test_admin']);
  
  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE "User" SET password = $1, role = $2, "isActive" = true, name = $3 WHERE username = $4',
      [hashedPassword, 'ADMIN', 'Test Administrator', 'test_admin']
    );
    console.log('Updated existing test_admin user.');
  } else {
    await pool.query(
      'INSERT INTO "User" (id, username, password, name, email, role, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())',
      ['test_admin', hashedPassword, 'Test Administrator', 'testadmin@inventory.local', 'ADMIN']
    );
    console.log('Created test_admin user.');
  }
  
  await pool.end();
}

seedTestUser().catch(err => {
  console.error('Failed to seed test user:', err);
  process.exit(1);
});
