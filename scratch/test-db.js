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

prisma.inventoryTransaction.findMany({
  where: { transactionType: 'INBOUND' }
})
.then(async txs => {
  console.log('FOUND INBOUND TRANSACTIONS:', txs.map(t => ({ id: t.id, type: t.transactionType, qty: t.quantity, notes: t.notes })));
  if (txs.length > 0) {
    const ids = txs.map(t => t.id);
    const updateResult = await prisma.inventoryTransaction.updateMany({
      where: { id: { in: ids } },
      data: { transactionType: 'RETURN' }
    });
    console.log('UPDATE RESULT:', updateResult);
  }
  process.exit(0);
})
.catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
