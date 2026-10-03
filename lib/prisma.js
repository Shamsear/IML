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

// Create connection pool with limits to prevent development & serverless connection exhaustion
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const pool = globalForPrisma.prismaPool ?? new Pool({ 
  connectionString: normalizeConnectionString(process.env.DATABASE_URL),
  max: isServerless ? 3 : (process.env.NODE_ENV === 'production' ? 10 : 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000
});

// Create adapter
const adapter = new PrismaPg(pool);

// Create Prisma Client with adapter
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

globalForPrisma.prisma = prisma;
globalForPrisma.prismaPool = pool;

// Export both default and named export for compatibility
export default prisma;
export { prisma };
