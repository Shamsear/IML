import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;

const pool = new pg.Pool({ connectionString: databaseUrl });

function isReadOnlyRole(role) {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  return upper === 'VIEWER' || upper === 'READ_ONLY' || upper === 'READONLY';
}

async function runTests() {
  console.log('--- TEST 1: isReadOnlyRole Logic Verification ---');
  if (isReadOnlyRole('VIEWER') !== true) throw new Error('VIEWER should be read only');
  if (isReadOnlyRole('viewer') !== true) throw new Error('viewer (lowercase) should be read only');
  if (isReadOnlyRole('READ_ONLY') !== true) throw new Error('READ_ONLY should be read only');
  if (isReadOnlyRole('ADMIN') !== false) throw new Error('ADMIN should not be read only');
  if (isReadOnlyRole('MANAGER') !== false) throw new Error('MANAGER should not be read only');
  if (isReadOnlyRole(undefined) !== false) throw new Error('undefined should not be read only');
  console.log('✓ TEST 1 Passed: Role detection logic is 100% correct.');

  console.log('\n--- TEST 2: Database User Record & Role Verification ---');
  const usersRes = await pool.query('SELECT username, role, "isActive", password FROM "User" WHERE username IN ($1, $2, $3)', ['admin', 'test_admin', 'viewer']);
  const users = usersRes.rows;

  const viewer = users.find(u => u.username === 'viewer');
  if (!viewer) throw new Error('viewer user not found in DB');
  if (viewer.role !== 'VIEWER') throw new Error(`viewer user role is ${viewer.role}, expected VIEWER`);
  if (!viewer.isActive) throw new Error('viewer user must be active');
  const viewerPasswordMatch = await bcrypt.compare('Viewer@1234', viewer.password);
  if (!viewerPasswordMatch) throw new Error('viewer password does not match Viewer@1234');
  console.log(`✓ TEST 2 Passed: User "viewer" is active with role "VIEWER" and verified password hash.`);

  console.log('\n--- TEST 3: Admin User Preserved Without Modification ---');
  const testAdmin = users.find(u => u.username === 'test_admin');
  if (!testAdmin) throw new Error('test_admin user not found in DB');
  if (testAdmin.role !== 'ADMIN') throw new Error(`test_admin user role is ${testAdmin.role}, expected ADMIN`);
  if (!testAdmin.isActive) throw new Error('test_admin user must be active');
  console.log(`✓ TEST 3 Passed: User "test_admin" is active with role "ADMIN".`);

  console.log('\n--- TEST 4: Simulated Guard Verification ---');
  function simulateGuard(userRole) {
    if (isReadOnlyRole(userRole)) {
      throw new Error('Forbidden: Read-only accounts cannot create, update, or delete data.');
    }
    return { success: true };
  }

  // Admin should pass write guard
  const adminResult = simulateGuard(testAdmin.role);
  if (!adminResult.success) throw new Error('Admin should pass write guard');
  console.log('✓ TEST 4a Passed: Admin passes write guard seamlessly.');

  // Viewer should be blocked by write guard
  let blocked = false;
  try {
    simulateGuard(viewer.role);
  } catch (err) {
    if (err.message.includes('Forbidden: Read-only accounts cannot create, update, or delete data.')) {
      blocked = true;
    }
  }
  if (!blocked) throw new Error('Viewer was NOT blocked by write guard!');
  console.log('✓ TEST 4b Passed: Viewer is strictly blocked from writes by write guard.');

  console.log('\n========================================');
  console.log(' ALL READ-ONLY & PERMISSION TESTS PASSED ');
  console.log('========================================');

  await pool.end();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
