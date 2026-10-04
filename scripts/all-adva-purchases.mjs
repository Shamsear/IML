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

console.log('=== ALL ADVAMEDIA ENTRIES IN PURCHASE SHEET ===\n');
purRows.forEach((r, idx) => {
  if (!r || !r[0]) return;
  const vendor = String(r[1] || '');
  if (vendor.toLowerCase().includes('adva')) {
    const items = [];
    for (let c = 4; c < r.length - 1; c++) {
      if (r[c] && Number(r[c]) > 0) {
        items.push({ product: purH[c], qty: r[c] });
      }
    }
    console.log(`Purchase Row ${idx + 1} | Date: ${parseDate(r[0])} | Remark: "${r[r.length - 1] || ''}"`);
    console.log('   Items:', items.map(i => `${i.qty}x ${i.product}`).join(', '));
  }
});
