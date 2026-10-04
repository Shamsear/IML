import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

console.log('Purchase Row 173:');
const purSheet = wb.Sheets['Purchase'];
const purRows = xlsx.utils.sheet_to_json(purSheet, { header: 1 });
console.log(purRows[172]);

console.log('\nRemarks Sheet:');
const remSheet = wb.Sheets['remarks'];
if (remSheet) {
  const remRows = xlsx.utils.sheet_to_json(remSheet, { header: 1 });
  console.log(remRows);
}
