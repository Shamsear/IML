import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const workbook = xlsx.readFile(filePath);

const rebrandSheet = workbook.Sheets['REBRANDING'];
const rebrandRows = xlsx.utils.sheet_to_json(rebrandSheet, { header: 1 });
const rebrandHeaders = rebrandRows[0];

const purchaseSheet = workbook.Sheets['Purchase'];
const purchaseRows = xlsx.utils.sheet_to_json(purchaseSheet, { header: 1 });
const purchaseHeaders = purchaseRows[0];

function parseDate(excelDate) {
  if (!excelDate) return 'N/A';
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

console.log('=== COMPLETE COMPARISON: REBRANDING SENT vs PURCHASE RECEIVED ===\n');

for (let r = 1; r < rebrandRows.length; r++) {
  const row = rebrandRows[r];
  if (!row || !row[0]) continue;
  const dateNum = row[0];
  const remarks = row[row.length - 1];
  
  const fromItems = [];
  for (let c = 1; c < row.length - 1; c++) {
    const val = row[c];
    if (val && Number(val) > 0) {
      fromItems.push({ product: rebrandHeaders[c], qty: val, col: c });
    }
  }

  // Find corresponding Advamedia rows in Purchase around dateNum (within +- 10 days)
  const matchedPurchases = [];
  for (let pr = 1; pr < purchaseRows.length; pr++) {
    const pRow = purchaseRows[pr];
    if (!pRow || !pRow[0]) continue;
    const pDate = pRow[0];
    const vendor = pRow[1];
    if (vendor && String(vendor).toLowerCase().includes('adva')) {
      if (Math.abs(pDate - dateNum) <= 15) {
        // Collect items received in this purchase row
        const receivedItems = [];
        for (let pc = 4; pc < pRow.length; pc++) {
          const pVal = pRow[pc];
          if (pVal && Number(pVal) > 0) {
            receivedItems.push({ product: purchaseHeaders[pc], qty: pVal, col: pc });
          }
        }
        if (receivedItems.length > 0) {
          matchedPurchases.push({
            pRowIdx: pr + 1,
            date: parseDate(pDate),
            dateNum: pDate,
            items: receivedItems,
            notes: pRow[pRow.length - 1]
          });
        }
      }
    }
  }

  console.log(`\n-------------------------------------------------------------`);
  console.log(`REBRAND ROW ${r + 1} | Date: ${parseDate(dateNum)} (${dateNum}) | Remarks: "${remarks || ''}"`);
  console.log(`  OUTBOUND (Sent for Rebranding):`);
  fromItems.forEach(i => console.log(`    - ${i.qty}x [${i.product}] (Col ${i.col})`));
  
  console.log(`  MATCHING INBOUND (Received from Advamedia in Purchase):`);
  matchedPurchases.forEach(mp => {
    console.log(`    [Purchase Row ${mp.pRowIdx} | Date: ${mp.date} | Remarks: ${mp.notes || 'None'}]`);
    mp.items.forEach(i => console.log(`       + ${i.qty}x [${i.product}] (Col ${i.col})`));
  });
}
