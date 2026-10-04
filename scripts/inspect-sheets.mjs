import fs from 'fs';
import pg from 'pg';
import xlsx from 'xlsx';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: dbUrlMatch[1] });

const excelFile = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(excelFile);

console.log('Sheets:', wb.SheetNames);

async function run() {
  // Let's inspect the TOTAL/Balance sheet in Excel
  const stockSheet = wb.Sheets['TOTAL STOCK'] || wb.Sheets['Stock'] || wb.Sheets['Balance'] || wb.Sheets['SUMMARY'];
  console.log('Found balance sheet:', Object.keys(wb.Sheets));

  // Let's inspect each sheet name
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet "${sheetName}" has ${data.length} rows`);
  }

  await pool.end();
}

run().catch(console.error);
