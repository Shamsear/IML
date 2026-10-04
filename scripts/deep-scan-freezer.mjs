import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

console.log('--- EXAMINING FREEZER ACROSS ALL SHEETS ---');

for (const sName of wb.SheetNames) {
  const sheet = wb.Sheets[sName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows[0] || [];
  
  headers.forEach((h, colIdx) => {
    if (h && String(h).toLowerCase().includes('freezer')) {
      console.log(`\nSheet "${sName}" Col ${colIdx}: "${h}"`);
      rows.forEach((r, rIdx) => {
        if (rIdx > 0 && r[colIdx] !== null && r[colIdx] !== undefined && r[colIdx] !== '' && r[colIdx] !== 0) {
          console.log(`  Row ${rIdx + 1}: Date = ${r[0]}, Qty = ${r[colIdx]}, Vendor/Store = ${r[1]}, Remarks = "${r[r.length - 1]}"`);
        }
      });
    }
  });
}
