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

console.log('=== FULL AUDIT OF ALL 27 REBRAND ROWS ===\n');

for (let r = 1; r < rebRows.length; r++) {
  const row = rebRows[r];
  if (!row || !row[0]) continue;
  const dateNum = row[0];
  const remarks = row[row.length - 1];

  const fromItems = [];
  for (let c = 1; c < row.length - 1; c++) {
    const val = row[c];
    if (val && Number(val) > 0) {
      fromItems.push({ product: rebH[c], qty: val, col: c });
    }
  }

  // Find all purchase rows from Advamedia that happened after this rebrand date (up to 30 days later)
  const relevantPur = [];
  for (let pr = 1; pr < purRows.length; pr++) {
    const pRow = purRows[pr];
    if (!pRow || !pRow[0]) continue;
    const pDate = pRow[0];
    const vendor = String(pRow[1] || '');
    if (vendor.toLowerCase().includes('adva')) {
      if (pDate >= dateNum - 2 && pDate <= dateNum + 20) {
        const pItems = [];
        for (let pc = 4; pc < pRow.length - 1; pc++) {
          if (pRow[pc] && Number(pRow[pc]) > 0) {
            const prod = purH[pc];
            if (prod && !prod.toLowerCase().includes('shirt') && !prod.toLowerCase().includes('cap') && !prod.toLowerCase().includes('clip') && !prod.toLowerCase().includes('coat') && !prod.toLowerCase().includes('hat') && !prod.toLowerCase().includes('banner') && !prod.toLowerCase().includes('bag') && !prod.toLowerCase().includes('apron')) {
              pItems.push({ product: prod, qty: pRow[pc] });
            }
          }
        }
        if (pItems.length > 0) {
          relevantPur.push({ pRow: pr + 1, date: parseDate(pDate), items: pItems, remark: pRow[pRow.length - 1] });
        }
      }
    }
  }

  console.log(`[Rebrand Row ${r + 1}] Date: ${parseDate(dateNum)} | Remarks: "${remarks || ''}"`);
  console.log(`   Source (FROM):`, fromItems.length ? fromItems.map(i => `${i.qty}x "${i.product}"`).join(', ') : 'None recorded');
  console.log(`   Destination (TO from Purchase):`, relevantPur.length ? relevantPur.map(p => `[Pur Row ${p.pRow} ${p.date} (${p.remark || 'no rem'})]: ` + p.items.map(i => `${i.qty}x "${i.product}"`).join(', ')).join(' | ') : 'None in date window');
  console.log('--------------------------------------------------------------------------------');
}
