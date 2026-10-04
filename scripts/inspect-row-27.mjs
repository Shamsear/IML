import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

const rebSheet = wb.Sheets['REBRANDING'];
const rebRows = xlsx.utils.sheet_to_json(rebSheet, { header: 1 });
const rebH = rebRows[0];

console.log('REBRAND ROW 27 FULL DATA:');
console.log('Date:', rebRows[26][0], 'Vendor:', rebRows[26][1], 'Remarks:', rebRows[26][rebRows[26].length - 1]);
rebRows[26].forEach((cell, cIdx) => {
  if (cell !== null && cell !== undefined && cell !== '' && cell !== 0) {
    console.log(`  Col ${cIdx} [${rebH[cIdx]}]: ${cell}`);
  }
});
