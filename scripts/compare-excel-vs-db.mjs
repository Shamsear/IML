import fs from 'fs';
import pg from 'pg';
import xlsx from 'xlsx';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

import { getProductStock } from '../lib/stock.js';

async function run() {
  const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');
  const dataSheet = wb.Sheets['DATA'];
  const dataRows = xlsx.utils.sheet_to_json(dataSheet);

  const dbProducts = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT id, "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    ORDER BY timestamp ASC
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  // Create Excel lookup by name
  const excelMap = new Map();
  for (const r of dataRows) {
    const cleanName = (r['Item Description'] || '').trim().toLowerCase();
    excelMap.set(cleanName, r);
  }

  const comparisonList = [];

  for (const p of dbProducts.rows) {
    const txList = txByProduct.get(p.id) || [];
    const dbStock = getProductStock(txList);

    const cleanName = (p.name || '').trim().toLowerCase();
    const excelRow = excelMap.get(cleanName);

    const exPurchased = excelRow ? excelRow['Purchased / Received'] : 'N/A';
    const exWarehouse = excelRow ? excelRow['Available In Warehouse'] : 'N/A';
    const exIssued = excelRow ? excelRow['Issued'] : 'N/A';
    const exDamage = excelRow ? excelRow['Damage'] : 'N/A';
    const exLost = excelRow ? excelRow['Lost / Not Found'] : 'N/A';
    const exWithClient = excelRow ? excelRow['With Client'] : 'N/A';
    const exRebrand = excelRow ? excelRow['Re Brand'] : 'N/A';

    const hasIssue = dbStock.warehouse < 0 || dbStock.issued < 0 || (dbStock.purchased === 0 && txList.length > 0) || (excelRow && Math.abs((dbStock.purchased || 0) - (Number(exPurchased) || 0)) > 0.01);

    comparisonList.push({
      itemCode: p.itemCode,
      name: p.name,
      dbPurchased: dbStock.purchased,
      exPurchased,
      dbWarehouse: dbStock.warehouse,
      exWarehouse,
      dbIssued: dbStock.issued,
      exIssued,
      dbDamage: dbStock.damage,
      exDamage,
      dbRebrand: dbStock.reBrand,
      exRebrand,
      hasIssue
    });
  }

  const issuesOnly = comparisonList.filter(c => c.hasIssue);
  console.log(`\n=== PRODUCTS WITH DISCREPANCIES OR NEGATIVE VALUES BETWEEN EXCEL AND DB (${issuesOnly.length}) ===\n`);
  console.table(issuesOnly);

  await pool.end();
}

run().catch(console.error);
