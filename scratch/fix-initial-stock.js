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

async function fixInitialStock() {
  const txs = await prisma.inventoryTransaction.findMany({
    where: {
      deliveryNote: {
        in: ['INITIAL_STOCK', 'initial_stock']
      }
    }
  });

  console.log(`Found ${txs.length} transactions with delivery note 'INITIAL_STOCK'.`);

  let count = 0;
  for (const tx of txs) {
    const prefix = tx.transactionType === 'RETURN' ? 'RET' : 'DN';
    const dateStr = new Date(tx.timestamp).getTime().toString().slice(-6);
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const generatedNote = `${prefix}-${dateStr}-${randStr}`;

    await prisma.inventoryTransaction.update({
      where: { id: tx.id },
      data: { deliveryNote: generatedNote }
    });
    count++;
  }

  console.log(`Updated ${count} transactions with generated delivery notes.`);
}

fixInitialStock()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
