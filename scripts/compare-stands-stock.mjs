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

  // Map of Excel product -> available Qty (Promotional Stands only: rows 3 to 45)
  const excelTotals = {};
  for (let r = 2; r < 46; r++) {
    const row = summaryRows[r];
    if (row && row[0] && typeof row[1] === 'number') {
      const name = String(row[0]).trim();
      excelTotals[name] = row[1];
    }
  }

  // Get current DB products & compute DB warehouse available stock
  const dbStocks = await pool.query(`
    SELECT 
      p.id,
      p.name,
      COALESCE(SUM(CASE 
        WHEN t."toEntityType" = 'WAREHOUSE' AND t."transactionType" IN ('RECEIVE', 'RETURN', 'REBRAND_IN') THEN t.quantity
        WHEN t."fromEntityType" = 'WAREHOUSE' AND t."transactionType" IN ('ISSUE', 'DAMAGE', 'LOST', 'USED', 'REBRAND', 'REBRAND_OUT', 'CLIENT_STOCK') THEN -t.quantity
        ELSE 0
      END), 0) as db_qty
    FROM "Product" p
    LEFT JOIN "InventoryTransaction" t ON p.id = t."productId"
    GROUP BY p.id, p.name
    ORDER BY p.name ASC
  `);

  const dbStockMap = {};
  dbStocks.rows.forEach(r => {
    dbStockMap[r.name.trim().toLowerCase()] = { id: r.id, name: r.name, qty: Number(r.db_qty) };
  });

  console.log('=== PROMOTIONAL STANDS ONLY: EXCEL SUMMARY vs CURRENT DB STOCK ===\n');

  let matchCount = 0;
  let diffCount = 0;
  const comparisonList = [];

  for (const [excelProdName, excelQty] of Object.entries(excelTotals)) {
    const cleanName = excelProdName.toLowerCase();
    const dbItem = dbStockMap[cleanName] || Object.values(dbStockMap).find(d => d.name.toLowerCase().replace(/['" -]/g, '') === cleanName.replace(/['" -]/g, ''));

    const dbQty = dbItem ? dbItem.qty : 'MISSING IN DB';
    const isMatch = dbItem && dbItem.qty === excelQty;

    if (isMatch) matchCount++;
    else diffCount++;

    comparisonList.push({
      'Promotional Stand Product': excelProdName,
      'Excel Summary': excelQty,
      'DB Available': dbQty,
      'Match?': isMatch ? '✅ MATCH' : '❌ DIFFERENCE'
    });
  }

  console.table(comparisonList);
  console.log(`\nPromotional Stands Summary: ${matchCount} Matches, ${diffCount} Differences out of ${Object.keys(excelTotals).length} stands.`);

  await pool.end();
}

run().catch(console.error);
