import fs from 'fs';
import pg from 'pg';
import xlsx from 'xlsx';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: dbUrlMatch[1] });

const excelFile = 'D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx';
const wb = xlsx.readFile(excelFile);

async function run() {
  const pNames = [
    'Sadia Promotional Stand (1*1) - New Look April 2026',
    'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"'
  ];

  for (const name of pNames) {
    console.log(`\n================== AUDITING: ${name} ==================`);
    
    // DB Transactions
    const dbTxs = await pool.query(`
      SELECT t.id, t."transactionType", t."fromEntityType", t."toEntityType", t.quantity, t."deliveryNote", t.timestamp
      FROM "InventoryTransaction" t
      JOIN "Product" p ON t."productId" = p.id
      WHERE p.name = $1
      ORDER BY t.timestamp ASC
    `, [name]);
    
    console.log('Database Transactions:');
    console.table(dbTxs.rows);

    // Sum in DB
    let sumIn = 0;
    let sumOut = 0;
    dbTxs.rows.forEach(r => {
      if (r.toEntityType === 'WAREHOUSE') sumIn += Number(r.quantity);
      if (r.fromEntityType === 'WAREHOUSE') sumOut += Number(r.quantity);
    });
    console.log(`DB Warehouse In: ${sumIn}, Out: ${sumOut} => DB Net Stock: ${sumIn - sumOut}`);

    // Check in Excel sheets
    ['Purchase', 'ISSUED', 'With Client', 'REBRANDING', 'DAMAGE', 'LOST', 'Used', 'Refund'].forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) return;
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const headers = rows[0];
      const colIdx = headers.findIndex(h => h && String(h).trim().toLowerCase() === name.toLowerCase());
      if (colIdx !== -1) {
        let totalQty = 0;
        const entries = [];
        for (let r = 1; r < rows.length; r++) {
          const val = rows[r][colIdx];
          if (val && Number(val) > 0) {
            totalQty += Number(val);
            entries.push({ row: r + 1, date: rows[r][0], qty: val, remarks: rows[r][rows[r].length - 1] });
          }
        }
        console.log(`Excel Sheet "${sheetName}" (Col ${colIdx}): Total = ${totalQty}, Entries:`, entries);
      }
    });
  }

  await pool.end();
}

run().catch(console.error);
