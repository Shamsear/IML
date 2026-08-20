/**
 * Comprehensive Migration Script: Fix All Remaining Transactions
 * 
 * This script:
 * 1. Fixes transactions with old custom formats
 * 2. Generates proper codes for transactions with no delivery note
 * 3. Ensures all transactions follow the new format
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

// Helper function to generate new code format
function generateNewCode(type, brandCode, date, sequence) {
  const dateObj = new Date(date);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;
  const seqStr = String(sequence).padStart(3, '0');
  
  return `${type}-${brandCode}-${dateStr}-${seqStr}`;
}

// Extract brand code from brand name
function getBrandCode(brandName) {
  if (!brandName) return 'GEN';
  return brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'GEN';
}

// Get type code from transaction type
function getTypeCode(transactionType) {
  const typeMap = {
    'RECEIVE': 'REC',
    'RETURN': 'RTN',
    'ISSUE': 'DN',
    'LOST': 'LOS',
    'DAMAGE': 'DAM',
  };
  return typeMap[transactionType] || 'TXN';
}

async function migrateRemaining() {
  console.log('🚀 Starting comprehensive migration...\n');

  try {
    // Find all transactions that need fixing
    const allTransactions = await prisma.inventoryTransaction.findMany({
      include: {
        product: {
          include: {
            brand: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    const needsMigration = [];

    for (const tx of allTransactions) {
      const note = tx.deliveryNote;
      
      // Check if it's already in new format
      const isNewFormat = note && note.match(/^(REC|RTN|DN|LOS|DAM)-[A-Z]{3}-\d{6}-\d{3}$/);
      
      if (!isNewFormat) {
        needsMigration.push(tx);
      }
    }

    console.log(`📦 Found ${needsMigration.length} transactions needing migration\n`);

    if (needsMigration.length === 0) {
      console.log('✅ All transactions are already in new format!');
      return;
    }

    // Group by type, brand, and date for sequential numbering
    const groupedTransactions = {};

    for (const tx of needsMigration) {
      const brandName = tx.product?.brand?.name || 'General';
      const brandCode = getBrandCode(brandName);
      const typeCode = getTypeCode(tx.transactionType);

      // Create grouping key: TYPE-BRAND-DATE
      const dateObj = new Date(tx.timestamp);
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const groupKey = `${typeCode}-${brandCode}-${dateKey}`;

      if (!groupedTransactions[groupKey]) {
        groupedTransactions[groupKey] = [];
      }

      groupedTransactions[groupKey].push({
        id: tx.id,
        oldCode: tx.deliveryNote || '(none)',
        typeCode,
        brandCode,
        brandName,
        date: dateObj,
        transactionType: tx.transactionType
      });
    }

    // Check existing codes to avoid conflicts
    const existingCodes = await prisma.inventoryTransaction.findMany({
      where: {
        deliveryNote: {
          not: null
        }
      },
      select: {
        deliveryNote: true
      },
      distinct: ['deliveryNote']
    });

    const existingSet = new Set(existingCodes.map(t => t.deliveryNote));

    // Generate new codes with sequential numbering
    const updates = [];
    
    for (const [groupKey, transactions] of Object.entries(groupedTransactions)) {
      const [typeCode, brandCode, dateKey] = groupKey.split('-');
      const dateObj = new Date(dateKey);
      
      // Find the next available sequence number for this group
      let sequenceStart = 1;
      while (true) {
        const testCode = generateNewCode(typeCode, brandCode, dateObj, sequenceStart);
        if (!existingSet.has(testCode)) {
          break;
        }
        sequenceStart++;
      }

      transactions.forEach((tx, index) => {
        const newCode = generateNewCode(tx.typeCode, tx.brandCode, tx.date, sequenceStart + index);
        updates.push({
          id: tx.id,
          oldCode: tx.oldCode,
          newCode,
          type: tx.transactionType,
          brand: tx.brandName
        });
        existingSet.add(newCode); // Add to set to avoid duplicates within this run
      });
    }

    console.log('📝 Migration Plan:\n');
    console.log('┌────────────────────────────────────────┬────────────────────────┬──────────┬─────────────┐');
    console.log('│ Old Code                               │ New Code               │ Type     │ Brand       │');
    console.log('├────────────────────────────────────────┼────────────────────────┼──────────┼─────────────┤');
    
    updates.slice(0, 10).forEach(u => {
      const oldDisplay = u.oldCode.padEnd(38);
      console.log(`│ ${oldDisplay} │ ${u.newCode.padEnd(22)} │ ${u.type.padEnd(8)} │ ${u.brand.padEnd(11)} │`);
    });
    
    if (updates.length > 10) {
      console.log(`│ ... and ${updates.length - 10} more transactions`);
    }
    
    console.log('└────────────────────────────────────────┴────────────────────────┴──────────┴─────────────┘\n');

    // Ask for confirmation
    console.log(`⚠️  About to update ${updates.length} transaction codes.`);
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Perform the updates in a transaction
    console.log('🔄 Updating transaction codes...\n');
    
    let successCount = 0;
    let errorCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        try {
          await tx.inventoryTransaction.update({
            where: { id: update.id },
            data: { deliveryNote: update.newCode }
          });
          successCount++;
          
          if (successCount % 5 === 0) {
            console.log(`  ✓ Updated ${successCount}/${updates.length} transactions...`);
          }
        } catch (error) {
          console.error(`  ✗ Failed to update ${update.id}: ${error.message}`);
          errorCount++;
        }
      }
    });

    console.log('\n✅ Migration Complete!\n');
    console.log(`📊 Results:`);
    console.log(`   - Successfully updated: ${successCount} transactions`);
    console.log(`   - Failed: ${errorCount} transactions`);
    console.log(`   - Total processed: ${updates.length} transactions\n`);

    // Show summary by type
    const summary = {};
    updates.forEach(u => {
      const typeCode = u.newCode.split('-')[0];
      summary[typeCode] = (summary[typeCode] || 0) + 1;
    });

    console.log('📈 Summary by Transaction Type:');
    Object.entries(summary).forEach(([type, count]) => {
      const typeName = {
        'REC': 'Receive',
        'RTN': 'Return',
        'DN': 'Delivery',
        'LOS': 'Loss',
        'DAM': 'Damage',
        'TXN': 'Other'
      }[type] || type;
      console.log(`   - ${typeName} (${type}): ${count} transactions`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run migration
migrateRemaining()
  .then(() => {
    console.log('\n🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
