import fs from 'fs';
import pg from 'pg';
import xlsx from 'xlsx';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: dbUrlMatch[1] });

const excelFile = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(excelFile);

async function run() {
  const summarySheet = wb.Sheets['SUMMARY'];
  const summaryRows = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });
  
  console.log('SUMMARY Headers (Row 1):', summaryRows[0]);
  console.log('SUMMARY Headers (Row 2):', summaryRows[1]);

  console.log('\nFirst 20 data rows in SUMMARY:');
  for (let i = 2; i < 25; i++) {
    console.log(`Row ${i + 1}:`, JSON.stringify(summaryRows[i]));
  }

  await pool.end();
}

run().catch(console.error);
