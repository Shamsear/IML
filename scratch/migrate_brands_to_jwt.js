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
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { brandId, brandName, iat: Math.floor(Date.now() / 1000) };
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
    const parts = brand.secretKey.split('.');
    if (parts.length !== 3) {
      console.log(`Brand "${brand.name}" has UUID/Legacy secretKey. Migrating to JWT...`);
      const newJwt = generateBrandJWT(brand.id, brand.name);
      await prisma.brand.update({
        where: { id: brand.id },
        data: { secretKey: newJwt }
      });
      migratedCount++;
      console.log(`Migrated "${brand.name}" successfully.`);
    } else {
      console.log(`Brand "${brand.name}" already has a JWT key. Skipping.`);
    }
  }
  
  console.log(`Migration complete! Successfully migrated ${migratedCount} brands.`);
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
