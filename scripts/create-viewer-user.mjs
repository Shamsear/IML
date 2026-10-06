import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!databaseUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function createViewerUser() {
  const username = process.argv[2] || 'viewer';
  const password = process.argv[3] || 'Viewer@1234';
  const name = process.argv[4] || 'Read-Only Viewer';
  const email = process.argv[5] || `${username}@inventory.local`;

  console.log(`Ensuring read-only user "${username}" exists with role VIEWER...`);
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM "User" WHERE username = $1', [username]);

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE "User" SET password = $1, role = $2, "isActive" = true, name = $3, email = $4 WHERE username = $5',
      [hashedPassword, 'VIEWER', name, email, username]
    );
    console.log(`✓ Updated existing "${username}" user to role VIEWER.`);
  } else {
    await pool.query(
      'INSERT INTO "User" (id, username, password, name, email, role, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())',
      [username, hashedPassword, name, email, 'VIEWER']
    );
    console.log(`✓ Created user "${username}" with role VIEWER.`);
  }

  console.log('\nUser Account Details:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     VIEWER`);

  await pool.end();
}

createViewerUser().catch(err => {
  console.error('Failed to create viewer user:', err);
  process.exit(1);
});
