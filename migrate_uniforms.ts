process.env.DATABASE_URL = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from './generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const products = await prisma.product.findMany({ include: { brand: true } });

  const uniformsToUpdate = products.filter(p => {
    const cat = p.category?.toUpperCase() || '';
    const name = p.name?.toLowerCase() || '';
    return cat === 'UNIFORMS' || 
           cat === 'UNIFORM' || 
           name.includes('uniform') || 
           name.includes('t shirt') || 
           name.includes('t-shirt') || 
           name.includes('chef coat') || 
           name.includes('chef hat') || 
           name.includes('abaya') ||
           name.includes('apron');
  });

  console.log(`Found ${uniformsToUpdate.length} uniform products to normalize to UNIFORM + isReturnable: true.`);

  let updatedCount = 0;
  for (const p of uniformsToUpdate) {
    const updated = await prisma.product.update({
      where: { id: p.id },
      data: {
        category: 'UNIFORM',
        isReturnable: true,
        isDisposable: false,
      }
    });
    console.log(`Updated product ${updated.id}: "${updated.name}" -> category: "${updated.category}", isReturnable: ${updated.isReturnable}, isDisposable: ${updated.isDisposable}`);
    updatedCount++;
  }

  console.log(`\nSuccessfully updated ${updatedCount} uniform products in database!`);

  await prisma.$disconnect();
  await pool.end();
}

run().catch(console.error);
