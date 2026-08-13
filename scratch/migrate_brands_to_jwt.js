import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import crypto from 'crypto';

const { Pool } = pkg;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-brand-portal-secret-key-12345';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateBrandJWT(brandId, brandName) {
  const header = { alg: 'HS256' };
  const payload = { b: brandId };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${signatureInput}.${signature}`;
}

async function run() {
  const brands = await prisma.brand.findMany();
  console.log(`Found ${brands.length} brands to inspect...`);
  
  let migratedCount = 0;
  for (const brand of brands) {
    // Force regeneration to upgrade keys to compact JWT standard
    console.log(`Regenerating compact JWT secretKey for Brand "${brand.name}"...`);
    const newJwt = generateBrandJWT(brand.id, brand.name);
    await prisma.brand.update({
      where: { id: brand.id },
      data: { secretKey: newJwt }
    });
    migratedCount++;
  }
  
  console.log(`Migration complete! Successfully migrated ${migratedCount} brands.`);
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
