process.env.DATABASE_URL = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from './generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const products = await prisma.product.findMany({ include: { brand: true } });
  console.log('TOTAL PRODUCTS IN DB:', products.length);
  products.forEach(p => {
    console.log(`ID: ${p.id} | SKU: ${p.itemCode} | Name: ${p.name} | Category: ${p.category} | Size: ${p.size} | isReturnable: ${p.isReturnable} | isDisposable: ${p.isDisposable}`);
  });
  await prisma.$disconnect();
  await pool.end();
}

run().catch(console.error);
