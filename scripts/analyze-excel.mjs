import xlsx from 'xlsx';

const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');

console.log('=== SUMMARY SHEET HEADERS & ROWS ===');
const summarySheet = wb.Sheets['SUMMARY'];
const summaryJson = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });

console.log('Top 15 rows of SUMMARY:');
for (let i = 0; i < Math.min(25, summaryJson.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(summaryJson[i]));
}

console.log('\n=== DATA SHEET TOP ROWS ===');
const dataSheet = wb.Sheets['DATA'];
const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 1 });
for (let i = 0; i < Math.min(10, dataJson.length); i++) {
  console.log(`Data Row ${i}:`, JSON.stringify(dataJson[i]));
}
