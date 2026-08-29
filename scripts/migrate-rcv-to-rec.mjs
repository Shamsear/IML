import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : null;
process.env.DATABASE_URL = databaseUrl;

import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log('🔍 Finding all transactions starting with RCV- ...');
  
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        deliveryNote: {
          startsWith: 'RCV-',
        },
      },
    });

    console.log(`Found ${transactions.length} transactions with RCV- prefix.`);

    if (transactions.length === 0) {
      console.log('No transactions found with RCV- prefix.');
      await pool.end();
      return;
    }

    let updatedCount = 0;
    for (const tx of transactions) {
      const oldNote = tx.deliveryNote;
      const newNote = oldNote.replace(/^RCV-/, 'REC-');
      console.log(`Updating transaction ${tx.id}: ${oldNote} -> ${newNote}`);
      
      await prisma.inventoryTransaction.update({
        where: { id: tx.id },
        data: { deliveryNote: newNote },
      });
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} transactions.`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await pool.end();
  }
}

run();
