import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

console.log('--- Checking Purchase Sheet around 25 Aug 2026 ---');
const purSheet = wb.Sheets['Purchase'];
const purRows = xlsx.utils.sheet_to_json(purSheet, { header: 1 });
const purH = purRows[0];

[224, 225, 226, 227, 228, 229, 230].forEach(rNum => {
  const row = purRows[rNum - 1];
  if (row) {
    console.log(`\nPurchase Row ${rNum}: Date = ${row[0]}, Vendor = ${row[1]}, Remarks = "${row[row.length - 1]}"`);
    row.forEach((cell, cIdx) => {
      if (cIdx >= 4 && cell !== null && cell !== undefined && cell !== '' && cell !== 0) {
        console.log(`  Col ${cIdx} [${purH[cIdx]}]: ${cell}`);
      }
    });
  }
});
