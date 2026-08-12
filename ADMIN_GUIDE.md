# Administrator Guide - Secure User Management

## Creating New Users (Admin Only)

### Method 1: Using API (Recommended)

After logging in as an administrator, use the user management API:

```javascript
// Create a new user
const response = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'newuser',
    name: 'Full Name',
    email: 'user@example.com',
    password: 'SecurePassword123!',
    role: 'ADMIN' // or 'MANAGER', 'VIEWER', etc.
  })
});

const user = await response.json();
console.log('User created:', user);
```

### Method 2: Direct Database Access (System Admin Only)

If you have direct database access:

```sql
-- First, generate a bcrypt hash for the password
-- Use an online bcrypt generator with 12 rounds
-- Example: https://bcrypt.online/

INSERT INTO "User" (id, username, password, name, email, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'username',
  '$2a$12$PASTE_BCRYPT_HASH_HERE',
  'Full Name',
  'user@example.com',
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

## User Management Operations

### List All Users
```javascript
const response = await fetch('/api/users');
const users = await response.json();
```

### Update User
```javascript
const response = await fetch(`/api/users/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Updated Name',
    email: 'newemail@example.com',
    password: 'NewPassword123!', // Optional
    role: 'MANAGER',
    isActive: true
  })
});
```

### Delete User
```javascript
const response = await fetch(`/api/users/${userId}`, {
  method: 'DELETE'
});
```

### Deactivate User (Preferred over deletion)
```javascript
const response = await fetch(`/api/users/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isActive: false })
});
```

## Password Security

### Password Requirements
- Minimum 8 characters
- Should include uppercase, lowercase, numbers, and special characters (recommended)
- Stored as bcrypt hash with 12 rounds

### Resetting User Password
```javascript
// Admin can reset any user's password
const response = await fetch(`/api/users/${userId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    password: 'NewTemporaryPassword123!'
  })
});

// Inform the user to change their password after first login
```

## Role-Based Access

### Available Roles
- **ADMIN**: Full system access, can manage users
- **MANAGER**: (Define based on your needs)
- **VIEWER**: (Define based on your needs)

### Role Checking in Code
```javascript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);

if (session?.user?.role === 'ADMIN') {
  // Allow admin actions
}
```

## Security Best Practices

### ✅ DO:
- Use strong passwords for all accounts
- Change default passwords immediately
- Regularly audit user accounts
- Deactivate users instead of deleting when possible
- Use HTTPS in production
- Keep NEXTAUTH_SECRET secure and unique

### ❌ DON'T:
- Share login credentials
- Store passwords in plain text
- Use the same password across accounts
- Leave inactive accounts enabled
- Commit .env files to version control
- Use weak or common passwords

## Troubleshooting

### User Can't Login
1. Verify user exists and is active:
   ```sql
   SELECT username, "isActive" FROM "User" WHERE username = 'theusername';
   ```
2. Check if password hash is valid (60 characters for bcrypt)
3. Verify NEXTAUTH_SECRET is set correctly

### Forgot Admin Password
If you lose admin access:
1. Access database directly
2. Generate new bcrypt hash
3. Update password:
   ```sql
   UPDATE "User" 
   SET password = '$2a$12$NEW_HASH_HERE', "updatedAt" = NOW()
   WHERE username = 'admin';
   ```

### API Returns 401 Unauthorized
- Ensure you're logged in
- Check session is valid
- Verify role permissions (ADMIN required for user management)

## Database Queries (For System Admins)

### List All Active Users
```sql
SELECT id, username, name, email, role, "createdAt"
FROM "User"
WHERE "isActive" = true
ORDER BY "createdAt" DESC;
```

### Find User by Username
```sql
SELECT * FROM "User" WHERE username = 'searchname';
```

### Count Total Users
```sql
SELECT COUNT(*) as total_users FROM "User";
```

### Recent Logins (if audit table exists)
```sql
-- This requires implementing an audit log table
-- See documentation for implementing activity tracking
```

## Contact

For system administration support, contact your IT department or system administrator.

**Important**: Never share database credentials or NEXTAUTH_SECRET with unauthorized users.
