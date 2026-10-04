const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    include: { brand: true }
  });
  console.log('Total products in DB:', products.length);

  const uniforms = products.filter(p => 
    p.category?.toUpperCase() === 'UNIFORM' || 
    p.category?.toUpperCase() === 'UNIFORMS' ||
    p.name?.toLowerCase().includes('uniform') ||
    p.name?.toLowerCase().includes('t-shirt') ||
    p.name?.toLowerCase().includes('shirt') ||
    p.name?.toLowerCase().includes('polo') ||
    p.size != null
  );

  console.log('\n--- UNIFORM PRODUCTS IN DB ---');
  console.log('Count:', uniforms.length);
  uniforms.forEach(p => {
    console.log(`ID: ${p.id} | SKU: ${p.itemCode} | Name: ${p.name} | Category: ${p.category} | Size: ${p.size} | isReturnable: ${p.isReturnable} | isDisposable: ${p.isDisposable}`);
  });

  console.log('\n--- ALL PRODUCTS IN DB ---');
  products.forEach(p => {
    console.log(`ID: ${p.id} | SKU: ${p.itemCode} | Name: ${p.name} | Category: ${p.category} | Size: ${p.size} | isReturnable: ${p.isReturnable} | isDisposable: ${p.isDisposable}`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
