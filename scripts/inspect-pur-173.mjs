import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);
const purSheet = wb.Sheets['Purchase'];
const purRows = xlsx.utils.sheet_to_json(purSheet, { header: 1 });
const purH = purRows[0];

console.log('Purchase Row 173 details:');
purRows[172].forEach((cell, cIdx) => {
  if (cell !== null && cell !== undefined && cell !== '' && cell !== 0) {
    console.log(`  Col ${cIdx} [${purH[cIdx]}]: ${cell}`);
  }
});
