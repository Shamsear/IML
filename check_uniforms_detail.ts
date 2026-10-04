process.env.DATABASE_URL = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from './generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const products = await prisma.product.findMany({ include: { brand: true } });
  
  console.log('=== LIST OF ALL PRODUCTS WITH CATEGORY UNIFORM OR UNIFORMS OR NAME MATCHING UNIFORM/T-SHIRT/SHIRT/COAT/HAT/CAP/APRON OR SIZE !== NULL ===\n');

  const uniforms = products.filter(p => {
    const cat = p.category?.toUpperCase() || '';
    const name = p.name?.toLowerCase() || '';
    return cat.includes('UNIFORM') || 
           name.includes('uniform') || 
           name.includes('t shirt') || 
           name.includes('t-shirt') || 
           name.includes('chef coat') || 
           name.includes('chef hat') || 
           p.size != null;
  });

  uniforms.forEach(p => {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Category: "${p.category}" | Size: ${p.size} | isReturnable: ${p.isReturnable} | isDisposable: ${p.isDisposable}`);
  });
  
  await prisma.$disconnect();
  await pool.end();
}

run().catch(console.error);
