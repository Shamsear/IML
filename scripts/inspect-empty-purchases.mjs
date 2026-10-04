import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);
const purSheet = wb.Sheets['Purchase'];
const purRows = xlsx.utils.sheet_to_json(purSheet, { header: 1 });
const purH = purRows[0];

const inspectRows = [149, 174, 187, 189, 194, 204, 208, 210, 214, 232];

inspectRows.forEach(rNum => {
  const row = purRows[rNum - 1];
  console.log(`\n--- Purchase Row ${rNum} ---`);
  console.log('Date:', row[0], 'Vendor:', row[1], 'Remarks:', row[row.length - 1]);
  row.forEach((cell, cIdx) => {
    if (cIdx >= 4 && cell !== null && cell !== undefined && cell !== '' && cell !== 0) {
      console.log(`  Col ${cIdx} [${purH[cIdx]}]: ${cell}`);
    }
  });
});
