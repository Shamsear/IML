import fs from 'fs';
import xlsx from 'xlsx';

const excelFile = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(excelFile);

const sumSheet = wb.Sheets['SUMMARY'];
const sumRows = xlsx.utils.sheet_to_json(sumSheet, { header: 1 });

console.log('Total SUMMARY Available Promotional Stands:', sumRows[1][1]);
let standSum = 0;
for (let r = 2; r < 46; r++) {
  const row = sumRows[r];
  if (row && row[0] && typeof row[1] === 'number') {
    standSum += row[1];
    console.log(`  ${row[0]}: ${row[1]}`);
  }
}
console.log('Calculated Stand Sum:', standSum);
