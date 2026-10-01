import xlsx from 'xlsx';

const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');
const purchaseSheet = wb.Sheets['Purchase'];
const purchaseRows = xlsx.utils.sheet_to_json(purchaseSheet, { header: 1 });

console.log(`=== PURCHASE SHEET IN EXCEL (Total Rows: ${purchaseRows.length}) ===`);
console.log('Headers:', purchaseRows[0]);

// Find all products in Purchase sheet
const purchaseCounts = {};
for (let i = 1; i < purchaseRows.length; i++) {
  const row = purchaseRows[i];
  if (!row || row.length === 0) continue;
  // Let's see all columns in this row
  for (let c = 2; c < row.length; c++) {
    const colName = purchaseRows[0][c];
    const val = row[c];
    if (val && typeof val === 'number') {
      purchaseCounts[colName] = (purchaseCounts[colName] || 0) + val;
    }
  }
}

console.log('\nTotal Purchased from Purchase sheet columns:');
console.table(Object.entries(purchaseCounts).map(([name, qty]) => ({ name, qty })));
