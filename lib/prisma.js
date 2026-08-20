import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Singleton pattern for Prisma Client
// Prevents multiple instances in development due to hot reloading
const globalForPrisma = globalThis;

// Create connection pool with limits to prevent development exhaustion
const pool = globalForPrisma.prismaPool ?? new Pool({ 
  connectionString: process.env.DATABASE_URL,
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
