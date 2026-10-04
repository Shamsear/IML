import xlsx from 'xlsx';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(filePath);

console.log('--- REBRANDING SHEET: Rows around Date 46259 (25 Aug 2026) ---');
const rebSheet = wb.Sheets['REBRANDING'];
const rebRows = xlsx.utils.sheet_to_json(rebSheet, { header: 1 });
const rebH = rebRows[0];

rebRows.forEach((r, idx) => {
  if (r && (r[0] === 46259 || r[0] === '46259' || JSON.stringify(r).includes('Freezer') || JSON.stringify(r).includes('chef'))) {
    console.log(`\nRebrand Row ${idx + 1}: Date = ${r[0]}, Remarks = "${r[r.length - 1]}"`);
    r.forEach((cell, cIdx) => {
      if (cIdx > 0 && cIdx < r.length - 1 && cell !== null && cell !== undefined && cell !== '' && cell !== 0) {
        console.log(`  Col ${cIdx} [${rebH[cIdx]}]: ${cell}`);
      }
    });
  }
});

console.log('\n--- CHECKING ALL SHEETS FOR "Sadia Branded Freezer" ---');
wb.SheetNames.forEach(sName => {
  const sheet = wb.Sheets[sName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows[0] || [];
  const colIdx = headers.findIndex(h => h && String(h).toLowerCase().includes('freezer'));
  if (colIdx !== -1) {
    console.log(`\nSheet "${sName}" has Freezer in Col ${colIdx} [${headers[colIdx]}]:`);
    rows.forEach((r, rIdx) => {
      if (rIdx > 0 && r[colIdx] !== null && r[colIdx] !== undefined && r[colIdx] !== '' && r[colIdx] !== 0) {
        console.log(`  Row ${rIdx + 1}: Date = ${r[0]}, Val = ${r[colIdx]}, Remarks = ${r[r.length - 1]}`);
      }
    });
  }
});
