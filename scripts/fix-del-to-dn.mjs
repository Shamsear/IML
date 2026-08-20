/**
 * Fix Script: Update DEL codes to DN codes
 * Changes all DN-* transaction codes to DN-*
 */

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

async function fixCodes() {
  console.log('🔄 Updating DEL codes to DN codes...\n');

  try {
    // Find all transactions with DN- prefix
    const delTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        deliveryNote: { startsWith: 'DN-' }
      },
      select: {
        id: true,
        deliveryNote: true
      }
    });

    console.log(`📦 Found ${delTransactions.length} transactions with DN- codes\n`);

    if (delTransactions.length === 0) {
      console.log('✅ No transactions need updating!');
      return;
    }

    // Show preview
    console.log('📝 Preview of changes:\n');
    delTransactions.slice(0, 5).forEach(tx => {
      const newCode = tx.deliveryNote.replace('DN-', 'DN-');
      console.log(`  ${tx.deliveryNote} → ${newCode}`);
    });
    
    if (delTransactions.length > 5) {
      console.log(`  ... and ${delTransactions.length - 5} more\n`);
    } else {
      console.log('');
    }

    console.log('⚠️  Waiting 3 seconds before updating...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update all codes
    let successCount = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const transaction of delTransactions) {
        const newCode = transaction.deliveryNote.replace('DN-', 'DN-');
        
        await tx.inventoryTransaction.update({
          where: { id: transaction.id },
          data: { deliveryNote: newCode }
        });
        
        successCount++;
      }
    });

    console.log(`✅ Successfully updated ${successCount} transaction codes from DN-* to DN-*\n`);

  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run the fix
fixCodes()
  .then(() => {
    console.log('🎉 Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });
