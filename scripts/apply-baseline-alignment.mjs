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

  // Find max transaction ID
  let maxTxNum = 0;
  for (const t of txRes.rows) {
    const match = (t.id || '').match(/TXN-SAD-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxTxNum) maxTxNum = num;
    }
  }

  const excelRows = [];
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

  const newTxRecords = [];

  for (let i = 0; i < dbProducts.rows.length; i++) {
    const p = dbProducts.rows[i];
    const txList = txByProduct.get(p.id) || [];
    const dbStock = getProductStock(txList);
    const ex = excelRows[i];

    if (!ex) continue;

    const diffPurchased = ex.purchased - (dbStock.purchased || 0);
    const diffUsed = ex.used - (dbStock.used || 0);
    const diffDamage = ex.damage - (dbStock.damage || 0);
    const diffLost = ex.lost - (dbStock.lost || 0);
    const diffClient = ex.withClient - (dbStock.withClient || 0);
    const diffIssued = ex.issued - (dbStock.issued || 0);
    const diffRebrand = ex.reBrand - (dbStock.reBrand || 0);

    // 1. Check purchased difference
    if (diffPurchased > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'RECEIVE',
        fromEntityType: 'VENDOR',
        fromEntityId: 'VENDOR',
        toEntityType: 'WAREHOUSE',
        toEntityId: 'WH-MAIN',
        quantity: diffPurchased,
        deliveryNote: `DN-INIT-REC-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial opening purchase balance adjustment to match Excel DATA baseline',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 2. Check Used difference
    if (diffUsed > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'USED',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'CONSUMED',
        toEntityId: 'ACTIVATION',
        quantity: diffUsed,
        deliveryNote: `DN-INIT-USD-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial cumulative store consumption baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 3. Check Damage difference
    if (diffDamage > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'DAMAGE',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'DAMAGE',
        toEntityId: 'DAMAGE',
        quantity: diffDamage,
        deliveryNote: `DN-INIT-DAM-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial damaged asset baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 4. Check Lost difference
    if (diffLost > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'LOST',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'LOST',
        toEntityId: 'LOST',
        quantity: diffLost,
        deliveryNote: `DN-INIT-LOS-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial lost asset baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 5. Check With Client difference
    if (diffClient > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'CLIENT_STOCK',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'CLIENT',
        toEntityId: 'CLIENT_SAMPLE',
        quantity: diffClient,
        deliveryNote: `DN-INIT-CLT-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial client sample holding baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 6. Check Issued difference
    if (diffIssued > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'ISSUE',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'STORE',
        toEntityId: 'GENERAL_ISSUE',
        quantity: diffIssued,
        deliveryNote: `DN-INIT-ISS-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial issue baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }

    // 7. Check Rebrand difference
    if (diffRebrand > 0.001) {
      maxTxNum++;
      newTxRecords.push({
        id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
        productId: p.id,
        transactionType: 'REBRAND',
        fromEntityType: 'WAREHOUSE',
        fromEntityId: 'WH-MAIN',
        toEntityType: 'VENDOR',
        toEntityId: 'REBRAND_VENDOR',
        quantity: diffRebrand,
        deliveryNote: `DN-INIT-RBD-SAD-2025-${String(maxTxNum).slice(-3)}`,
        notes: 'Initial rebranding baseline adjustment to match Excel DATA summary',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      });
    }
  }

  console.log(`\n📦 Total Baseline Alignment Transactions to Insert: ${newTxRecords.length}`);
  
  if (newTxRecords.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const t of newTxRecords) {
        await client.query(`
          INSERT INTO "InventoryTransaction" (
            id, "productId", "transactionType", "fromEntityType", "fromEntityId",
            "toEntityType", "toEntityId", quantity, "deliveryNote", notes, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          t.id, t.productId, t.transactionType, t.fromEntityType, t.fromEntityId,
          t.toEntityType, t.toEntityId, t.quantity, t.deliveryNote, t.notes, t.timestamp
        ]);
      }
      await client.query('COMMIT');
      console.log(`✅ Successfully inserted all ${newTxRecords.length} baseline adjustment transactions!`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to insert:', e);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

run().catch(console.error);
