import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const workbook = xlsx.readFile(filePath);

const rebrandSheet = workbook.Sheets['REBRANDING'];
const rebrandRows = xlsx.utils.sheet_to_json(rebrandSheet, { header: 1 });
const rebrandHeaders = rebrandRows[0];

const purchaseSheet = workbook.Sheets['Purchase'];
const purchaseRows = xlsx.utils.sheet_to_json(purchaseSheet, { header: 1 });
const purchaseHeaders = purchaseRows[0];

console.log('--- EXAMINING EVERY ROW IN REBRANDING SHEET ---');
for (let r = 1; r < rebrandRows.length; r++) {
  const row = rebrandRows[r];
  if (!row || !row[0]) continue;
  const dateNum = row[0];
  const remarks = row[row.length - 1];
  
  // Find all items in this row with quantity > 0
  const itemsSent = [];
  for (let c = 1; c < row.length - 1; c++) {
    const val = row[c];
    if (val && Number(val) > 0) {
      itemsSent.push({ product: rebrandHeaders[c], qty: val, colIndex: c });
    }
  }
  
  console.log(`\nRebrand Row ${r + 1} | Excel Date: ${dateNum} | Remarks: "${remarks || ''}"`);
  console.log('  Items Sent Out (FROM):', itemsSent);
}
