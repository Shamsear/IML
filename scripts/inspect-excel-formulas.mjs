import xlsx from 'xlsx';

const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');

const dataSheet = wb.Sheets['DATA'];
// Let's read formulas and values
const range = xlsx.utils.decode_range(dataSheet['!ref']);

console.log('=== DATA SHEET FORMULAS & CELL VALUES ===');
for (let R = range.s.r; R <= Math.min(range.e.r, 20); R++) {
  const row = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = dataSheet[xlsx.utils.encode_cell({ r: R, c: C })];
    if (cell) {
      row.push({
        val: cell.v,
        formula: cell.f || null
      });
    } else {
      row.push(null);
    }
  }
  console.log(`Row ${R} (${row[0]?.val}):`, JSON.stringify(row.slice(0, 12)));
}

// Search for "Sadia logo Broast Headers  - (New 2025)" in DATA and all sheets
console.log('\n=== SEARCHING FOR SPECIFIC PRODUCTS IN ALL SHEETS ===');
for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < json.length; i++) {
    const rowStr = JSON.stringify(json[i]);
    if (rowStr.toLowerCase().includes('broast headers') || rowStr.toLowerCase().includes('new 2025') || rowStr.toLowerCase().includes('wooden chef')) {
      console.log(`Sheet [${sheetName}] Row ${i}:`, rowStr);
    }
  }
}
