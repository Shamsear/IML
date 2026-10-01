import fs from 'fs';
import pg from 'pg';
import xlsx from 'xlsx';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

import { getProductStock } from '../lib/stock.js';

async function run() {
  const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx', { sheets: ['DATA'] });
  const dataSheet = wb.Sheets['DATA'];
  const dataRows = xlsx.utils.sheet_to_json(dataSheet);

  const dbProducts = await pool.query(`
    SELECT p.id, p."itemCode", p.name
    FROM "Product" p
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT id, "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  let totalMatches = 0;
  const discrepancies = [];

  for (let i = 0; i < dbProducts.rows.length; i++) {
    const p = dbProducts.rows[i];
    const txList = txByProduct.get(p.id) || [];
    const dbStock = getProductStock(txList);
    const r = dataRows[i];

    const exPurchased = Number(r['Purchased / Received']) || 0;
    const exWarehouse = Number(r['Available In Warehouse']) || 0;
    const exIssued = Number(r['Issued']) || 0;
    const exUsed = Number(r['Used']) || 0;
    const exDamage = Number(r['Damage']) || 0;
    const exLost = Number(r['Lost / Not Found']) || 0;
    const exClient = Number(r['With Client']) || 0;
    const exRebrand = Number(r['Re Brand']) || 0;

    const diffWH = Math.abs(exWarehouse - (dbStock.warehouse || 0));
    const diffPurchased = Math.abs(exPurchased - (dbStock.purchased || 0));

    if (diffWH < 0.001 && diffPurchased < 0.001) {
      totalMatches++;
    } else {
      discrepancies.push({
        code: p.itemCode,
        name: p.name,
        dbWarehouse: dbStock.warehouse,
        exWarehouse,
        dbPurchased: dbStock.purchased,
        exPurchased,
      });
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎯 TOTAL PRODUCTS CHECKED: ${dbProducts.rows.length}`);
  console.log(`✅ EXACT 1:1 MATCHES WITH EXCEL DATA: ${totalMatches} / ${dbProducts.rows.length}`);
  console.log(`⚠️ DISCREPANCIES: ${discrepancies.length}`);
  console.log(`==================================================\n`);

  if (discrepancies.length > 0) {
    console.table(discrepancies);
  }

  await pool.end();
}

run().catch(console.error);
