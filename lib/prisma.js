import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Singleton pattern for Prisma Client
// Prevents multiple instances in development due to hot reloading
const globalForPrisma = globalThis;

/**
 * Normalize DATABASE_URL sslmode to avoid pg-connection-string v3 deprecation warning.
 * 'prefer', 'require', and 'verify-ca' are currently treated as aliases for 'verify-full'
 * but will adopt weaker libpq semantics in pg v9.0.0. Use 'verify-full' explicitly.
 */
function normalizeConnectionString(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get('sslmode');
    if (sslmode && sslmode !== 'verify-full' && sslmode !== 'disable' && sslmode !== 'allow') {
      parsed.searchParams.set('sslmode', 'verify-full');
      return parsed.toString();
    }
  } catch (e) {
    // Not a valid URL (e.g. non-POSTGRES dialect), return as-is
  }
  return url;
}

// Create connection pool with limits to prevent development exhaustion
const pool = globalForPrisma.prismaPool ?? new Pool({ 
  connectionString: normalizeConnectionString(process.env.DATABASE_URL),
  max: process.env.NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000
});

// Create adapter
const adapter = new PrismaPg(pool);

// Create Prisma Client with adapter
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}

// Export both default and named export for compatibility
export default prisma;
export { prisma };
