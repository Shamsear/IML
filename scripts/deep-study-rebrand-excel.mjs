import xlsx from 'xlsx';
import fs from 'fs';

const filePath = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const workbook = xlsx.readFile(filePath);

console.log('Sheets in workbook:', workbook.SheetNames);

// 1. Inspect REBRANDING sheet
const rebrandSheet = workbook.Sheets['REBRANDING'];
const rebrandRows = xlsx.utils.sheet_to_json(rebrandSheet, { header: 1 });

console.log('\n--- REBRANDING SHEET (First 35 rows) ---');
rebrandRows.slice(0, 35).forEach((r, idx) => {
  if (r.length > 0 && r.some(cell => cell !== undefined && cell !== '')) {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  }
});

// 2. Inspect Purchase sheet for Advamedia / Rebranding records
const purchaseSheet = workbook.Sheets['Purchase'];
const purchaseRows = xlsx.utils.sheet_to_json(purchaseSheet, { header: 1 });

console.log('\n--- PURCHASE SHEET (Advamedia / Rebrand related rows) ---');
console.log('Purchase Header:', JSON.stringify(purchaseRows[0]));
purchaseRows.forEach((r, idx) => {
  const rowStr = JSON.stringify(r);
  if (rowStr.toLowerCase().includes('adva') || rowStr.toLowerCase().includes('rebrand') || rowStr.toLowerCase().includes('rbd')) {
    console.log(`Purchase Row ${idx + 1}:`, rowStr);
  }
});
