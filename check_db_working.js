process.env.DATABASE_URL = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

async function run() {
  const mod = await import('./lib/prisma.js');
  const prisma = mod.prisma;
  console.log('Is prisma defined:', !!prisma);
  const products = await prisma.product.findMany({ include: { brand: true } });
  console.log('TOTAL PRODUCTS IN DB:', products.length);
  products.forEach(p => {
    console.log(`ID: ${p.id} | SKU: ${p.itemCode} | Name: ${p.name} | Category: ${p.category} | Size: ${p.size} | isReturnable: ${p.isReturnable} | isDisposable: ${p.isDisposable}`);
  });
  await prisma.$disconnect();
}
run().catch(console.error);
