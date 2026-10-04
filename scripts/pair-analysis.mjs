import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

const rebSheet = wb.Sheets['REBRANDING'];
const rebRows = xlsx.utils.sheet_to_json(rebSheet, { header: 1 });
const rebH = rebRows[0];

const purSheet = wb.Sheets['Purchase'];
const purRows = xlsx.utils.sheet_to_json(purSheet, { header: 1 });
const purH = purRows[0];

function parseDate(excelDate) {
  if (!excelDate) return 'N/A';
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

console.log('=== EXACT REBRAND PAIR ANALYSIS ===\n');

for (let r = 1; r < rebRows.length; r++) {
  const row = rebRows[r];
  if (!row || !row[0]) continue;
  const dateNum = row[0];
  const remarks = row[row.length - 1];

  const fromItems = [];
  for (let c = 1; c < row.length - 1; c++) {
    const val = row[c];
    if (val && Number(val) > 0) {
      fromItems.push({ product: rebH[c], qty: val });
    }
  }

  // Look up Advamedia row in purchase matching dateNum or remarks
  const matchingPur = [];
  for (let pr = 1; pr < purRows.length; pr++) {
    const pRow = purRows[pr];
    if (!pRow || !pRow[0]) continue;
    const pDate = pRow[0];
    const vendor = String(pRow[1] || '');
    if (vendor.toLowerCase().includes('adva')) {
      const pItems = [];
      for (let pc = 4; pc < pRow.length - 1; pc++) {
        if (pRow[pc] && Number(pRow[pc]) > 0) {
          pItems.push({ product: purH[pc], qty: pRow[pc] });
        }
      }
      // Filter out t-shirts, caps, etc. if we want stands
      const standItems = pItems.filter(i => !i.product.toLowerCase().includes('shirt') && !i.product.toLowerCase().includes('cap') && !i.product.toLowerCase().includes('clip') && !i.product.toLowerCase().includes('coat') && !i.product.toLowerCase().includes('hat') && !i.product.toLowerCase().includes('banner'));
      
      if (standItems.length > 0 && Math.abs(pDate - dateNum) <= 12) {
        matchingPur.push({ pRow: pr + 1, date: parseDate(pDate), items: standItems, remark: pRow[pRow.length - 1] });
      }
    }
  }

  console.log(`[Batch ${r}] Date: ${parseDate(dateNum)} | Excel Remarks: "${remarks || ''}"`);
  console.log(`  FROM (Outbound Sent to Adva):`, fromItems.map(i => `${i.qty}x ${i.product}`).join(', ') || 'None in this row');
  console.log(`  TO   (Inbound Converted Stands):`, matchingPur.map(mp => `[Row ${mp.pRow} ${mp.date}]: ` + mp.items.map(i => `${i.qty}x ${i.product}`).join(', ')).join(' | ') || 'None found');
  console.log('');
}
