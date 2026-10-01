import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

import { prisma } from '../lib/prisma.js';
import { getProductDetail } from '../app/actions/products.js';

// Mock requireAuth
global.mockUser = { id: 'admin', role: 'ADMIN' };

async function run() {
  const p = await getProductDetail('PROD-SAD-095');
  console.log('Product Detail for PROD-SAD-095:');
  console.log('ID:', p.id);
  console.log('Name:', p.name);
  console.log('Warehouse Stock:', p.warehouseStock);
  console.log('Stock Breakdown:', p.stock);
  await prisma.$disconnect();
}

run().catch(console.error);
