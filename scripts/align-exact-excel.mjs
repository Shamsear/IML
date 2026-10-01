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

  // Create Excel lookup by index and name
  const excelRows = [];
  // Row 2 in Excel corresponds to item 1
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const code = `PROD-SAD-${String(i + 1).padStart(3, '0')}`;
    excelRows.push({
      code,
      name: (r['Item Description'] || '').trim(),
      purchased: Number(r['Purchased / Received']) || 0,
      warehouse: Number(r['Available In Warehouse']) || 0,
      issued: Number(r['Issued']) || 0,
      used: Number(r['Used']) || 0,
      damage: Number(r['Damage']) || 0,
      lost: Number(r['Lost / Not Found']) || 0,
      withClient: Number(r['With Client']) || 0,
      reBrand: Number(r['Re Brand']) || 0,
    });
  }

  console.log(`Excel products count: ${excelRows.length}, DB products count: ${dbProducts.rows.length}`);

  const discrepancies = [];

  for (let i = 0; i < dbProducts.rows.length; i++) {
    const p = dbProducts.rows[i];
    const txList = txByProduct.get(p.id) || [];
    const dbStock = getProductStock(txList);
    const ex = excelRows[i];

    if (!ex) continue;

    const diffPurchased = ex.purchased - (dbStock.purchased || 0);
    const diffWarehouse = ex.warehouse - (dbStock.warehouse || 0);
    const diffIssued = ex.issued - (dbStock.issued || 0);
    const diffUsed = ex.used - (dbStock.used || 0);
    const diffDamage = ex.damage - (dbStock.damage || 0);
    const diffLost = ex.lost - (dbStock.lost || 0);
    const diffClient = ex.withClient - (dbStock.withClient || 0);
    const diffRebrand = ex.reBrand - (dbStock.reBrand || 0);

    const hasDiff = [diffPurchased, diffWarehouse, diffIssued, diffUsed, diffDamage, diffLost, diffClient, diffRebrand].some(d => Math.abs(d) > 0.001);

    if (hasDiff) {
      discrepancies.push({
        code: p.itemCode,
        name: p.name,
        dbPurchased: dbStock.purchased,
        exPurchased: ex.purchased,
        diffPurchased,
        dbWarehouse: dbStock.warehouse,
        exWarehouse: ex.warehouse,
        diffWarehouse,
        dbIssued: dbStock.issued,
        exIssued: ex.issued,
        diffIssued,
        dbUsed: dbStock.used,
        exUsed: ex.used,
        diffUsed,
        dbDamage: dbStock.damage,
        exDamage: ex.damage,
        diffDamage,
        dbLost: dbStock.lost,
        exLost: ex.lost,
        diffLost,
        dbClient: dbStock.withClient,
        exClient: ex.withClient,
        diffClient,
        dbRebrand: dbStock.reBrand,
        exRebrand: ex.reBrand,
        diffRebrand,
      });
    }
  }

  console.log(`\n=== PRODUCTS WITH ANY DISCREPANCY: ${discrepancies.length} / ${dbProducts.rows.length} ===\n`);
  for (const d of discrepancies) {
    console.log(`[${d.code}] ${d.name}`);
    if (Math.abs(d.diffPurchased) > 0.001) console.log(`  Purchased: DB=${d.dbPurchased} | Excel=${d.exPurchased} | Diff=${d.diffPurchased}`);
    if (Math.abs(d.diffWarehouse) > 0.001) console.log(`  Warehouse: DB=${d.dbWarehouse} | Excel=${d.exWarehouse} | Diff=${d.diffWarehouse}`);
    if (Math.abs(d.diffIssued) > 0.001) console.log(`  Issued:    DB=${d.dbIssued} | Excel=${d.exIssued} | Diff=${d.diffIssued}`);
    if (Math.abs(d.diffUsed) > 0.001) console.log(`  Used:      DB=${d.dbUsed} | Excel=${d.exUsed} | Diff=${d.diffUsed}`);
    if (Math.abs(d.diffDamage) > 0.001) console.log(`  Damage:    DB=${d.dbDamage} | Excel=${d.exDamage} | Diff=${d.diffDamage}`);
    if (Math.abs(d.diffLost) > 0.001) console.log(`  Lost:      DB=${d.dbLost} | Excel=${d.exLost} | Diff=${d.diffLost}`);
    if (Math.abs(d.diffClient) > 0.001) console.log(`  Client:    DB=${d.dbClient} | Excel=${d.exClient} | Diff=${d.diffClient}`);
    if (Math.abs(d.diffRebrand) > 0.001) console.log(`  Rebrand:   DB=${d.dbRebrand} | Excel=${d.exRebrand} | Diff=${d.diffRebrand}`);
  }

  await pool.end();
}

run().catch(console.error);
