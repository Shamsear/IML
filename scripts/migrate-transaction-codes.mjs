/**
 * Migration Script: Update Old Transaction Codes to New Format
 * 
 * This script updates all transactions with old delivery note formats:
 * - DN-######-#### → REC-{BRAND}-{DATE}-{SEQ}
 * - RET-######-#### → RTN-{BRAND}-{DATE}-{SEQ}
 * 
 * Run: node scripts/migrate-transaction-codes.mjs
 */

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

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

async function migrateCodes() {
  console.log('🚀 Starting transaction code migration...\n');

  try {
    // Find all transactions with old format delivery notes
    const oldFormatTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        OR: [
          { deliveryNote: { startsWith: 'DN-' } },
          { deliveryNote: { startsWith: 'RET-' } },
        ]
      },
      include: {
        product: {
          include: {
            brand: { select: { name: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`📦 Found ${oldFormatTransactions.length} transactions with old format codes\n`);

    if (oldFormatTransactions.length === 0) {
      console.log('✅ No transactions need migration!');
      return;
    }

    // Group transactions by type, brand, and date for sequential numbering
    const groupedTransactions = {};

    for (const tx of oldFormatTransactions) {
      const brandName = tx.product?.brand?.name || 'General';
      const brandCode = getBrandCode(brandName);
      
      // Determine transaction type code
      let typeCode;
      if (tx.transactionType === 'RECEIVE') {
        typeCode = 'REC';
      } else if (tx.transactionType === 'RETURN') {
        typeCode = 'RTN';
      } else if (tx.transactionType === 'ISSUE') {
        typeCode = 'DEL';
      } else if (tx.transactionType === 'LOST') {
        typeCode = 'LOS';
      } else if (tx.transactionType === 'DAMAGE') {
        typeCode = 'DAM';
      } else {
        typeCode = 'TXN'; // Fallback for other types
      }

      // Create grouping key: TYPE-BRAND-DATE
      const dateObj = new Date(tx.timestamp);
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const groupKey = `${typeCode}-${brandCode}-${dateKey}`;

      if (!groupedTransactions[groupKey]) {
        groupedTransactions[groupKey] = [];
      }

      groupedTransactions[groupKey].push({
        id: tx.id,
        oldCode: tx.deliveryNote,
        typeCode,
        brandCode,
        brandName,
        date: dateObj,
        transactionType: tx.transactionType
      });
    }

    // Generate new codes with sequential numbering
    const updates = [];
    
    for (const [groupKey, transactions] of Object.entries(groupedTransactions)) {
      transactions.forEach((tx, index) => {
        const newCode = generateNewCode(tx.typeCode, tx.brandCode, tx.date, index + 1);
        updates.push({
          id: tx.id,
          oldCode: tx.oldCode,
          newCode,
          type: tx.transactionType,
          brand: tx.brandName
        });
      });
    }

    console.log('📝 Migration Plan:\n');
    console.log('┌────────────────────────┬────────────────────────┬──────────┬─────────────┐');
    console.log('│ Old Code               │ New Code               │ Type     │ Brand       │');
    console.log('├────────────────────────┼────────────────────────┼──────────┼─────────────┤');
    
    updates.slice(0, 10).forEach(u => {
      console.log(`│ ${u.oldCode.padEnd(22)} │ ${u.newCode.padEnd(22)} │ ${u.type.padEnd(8)} │ ${u.brand.padEnd(11)} │`);
    });
    
    if (updates.length > 10) {
      console.log(`│ ... and ${updates.length - 10} more transactions`);
    }
    
    console.log('└────────────────────────┴────────────────────────┴──────────┴─────────────┘\n');

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
          
          if (successCount % 10 === 0) {
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
        'DEL': 'Delivery',
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
  }
}

// Run migration
migrateCodes()
  .then(() => {
    console.log('\n🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
