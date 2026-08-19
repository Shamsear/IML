import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;
process.env.DATABASE_URL = databaseUrl;

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

prisma.product.findMany({
  select: { id: true, name: true },
  orderBy: { id: 'asc' }
})
.then(products => {
  console.log('ALL PRODUCTS IN DB:', products);
  process.exit(0);
})
.catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
