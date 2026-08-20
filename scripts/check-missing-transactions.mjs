/**
 * Check for transactions that need migration
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

async function checkTransactions() {
  console.log('🔍 Checking for transactions needing migration...\n');

  try {
    // Get all transactions
    const allTransactions = await prisma.inventoryTransaction.findMany({
      select: {
        id: true,
        deliveryNote: true,
        transactionType: true,
        timestamp: true,
        product: {
          include: {
            brand: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`📦 Total transactions: ${allTransactions.length}\n`);

    // Categorize transactions
    const categories = {
      newFormat: [],      // REC-*, RTN-*, DN-*, LOS-*, DAM-*
      oldDN: [],          // DN-######-####
      oldRET: [],         // RET-######-####
      oldOUT: [],         // OUT-*
      oldLST: [],         // LST-*
      oldDMG: [],         // DMG-*
      oldOther: [],       // Other old formats
      noNote: [],         // NULL or empty
    };

    for (const tx of allTransactions) {
      const note = tx.deliveryNote;
      
      if (!note || note.trim() === '') {
        categories.noNote.push(tx);
      } else if (note.match(/^(REC|RTN|DN|LOS|DAM)-[A-Z]{3}-\d{6}-\d{3}$/)) {
        categories.newFormat.push(tx);
      } else if (note.match(/^DN-\d{6}-\d{4}$/)) {
        categories.oldDN.push(tx);
      } else if (note.match(/^RET-\d{6}-\d{4}$/)) {
        categories.oldRET.push(tx);
      } else if (note.startsWith('OUT-')) {
        categories.oldOUT.push(tx);
      } else if (note.startsWith('LST-')) {
        categories.oldLST.push(tx);
      } else if (note.startsWith('DMG-')) {
        categories.oldDMG.push(tx);
      } else {
        categories.oldOther.push(tx);
      }
    }

    // Display results
    console.log('📊 Transaction Breakdown:\n');
    console.log(`✅ New Format (REC/RTN/DN/LOS/DAM-*-*-*): ${categories.newFormat.length}`);
    console.log(`❌ Old DN-######-####: ${categories.oldDN.length}`);
    console.log(`❌ Old RET-######-####: ${categories.oldRET.length}`);
    console.log(`❌ Old OUT-*: ${categories.oldOUT.length}`);
    console.log(`❌ Old LST-*: ${categories.oldLST.length}`);
    console.log(`❌ Old DMG-*: ${categories.oldDMG.length}`);
    console.log(`❌ Other old formats: ${categories.oldOther.length}`);
    console.log(`⚠️  No delivery note: ${categories.noNote.length}\n`);

    const needsMigration = 
      categories.oldDN.length + 
      categories.oldRET.length + 
      categories.oldOUT.length + 
      categories.oldLST.length + 
      categories.oldDMG.length + 
      categories.oldOther.length + 
      categories.noNote.length;

    console.log(`🎯 Total needing migration: ${needsMigration}\n`);

    // Show samples from each category
    if (categories.oldDN.length > 0) {
      console.log('📝 Sample OLD DN formats:');
      categories.oldDN.slice(0, 3).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.oldRET.length > 0) {
      console.log('📝 Sample OLD RET formats:');
      categories.oldRET.slice(0, 3).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.oldOUT.length > 0) {
      console.log('📝 Sample OUT formats:');
      categories.oldOUT.slice(0, 3).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.oldLST.length > 0) {
      console.log('📝 Sample LST formats:');
      categories.oldLST.slice(0, 3).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.oldDMG.length > 0) {
      console.log('📝 Sample DMG formats:');
      categories.oldDMG.slice(0, 3).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.oldOther.length > 0) {
      console.log('📝 Sample OTHER formats:');
      categories.oldOther.slice(0, 5).forEach(tx => {
        console.log(`  ${tx.deliveryNote} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'}`);
      });
      console.log('');
    }

    if (categories.noNote.length > 0) {
      console.log('⚠️  Sample transactions with NO delivery note:');
      categories.noNote.slice(0, 5).forEach(tx => {
        const date = new Date(tx.timestamp).toISOString().split('T')[0];
        console.log(`  ${tx.id} (${tx.transactionType}) - ${tx.product?.brand?.name || 'No Brand'} - ${date}`);
      });
      console.log('');
    }

    // Show transaction type breakdown for those needing migration
    if (needsMigration > 0) {
      console.log('📈 Transaction Types Needing Migration:');
      const typeCount = {};
      
      [...categories.oldDN, ...categories.oldRET, ...categories.oldOUT, 
       ...categories.oldLST, ...categories.oldDMG, ...categories.oldOther, ...categories.noNote]
        .forEach(tx => {
          typeCount[tx.transactionType] = (typeCount[tx.transactionType] || 0) + 1;
        });
      
      Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkTransactions()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
