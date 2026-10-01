import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const maxTx = await pool.query(`
    SELECT id FROM "InventoryTransaction" ORDER BY id DESC LIMIT 1
  `);
  let maxTxNum = 0;
  if (maxTx.rows.length > 0) {
    const match = (maxTx.rows[0].id || '').match(/TXN-SAD-(\d+)/);
    if (match) maxTxNum = parseInt(match[1], 10);
  }

  const p = await pool.query(`
    SELECT id, "itemCode", name FROM "Product" WHERE "itemCode" = 'PROD-SAD-114'
  `);
  const prod = p.rows[0];

  maxTxNum++;
  const newTx = {
    id: `TXN-SAD-${String(maxTxNum).padStart(6, '0')}`,
    productId: prod.id,
    transactionType: 'RETURN',
    fromEntityType: 'CLIENT',
    fromEntityId: 'CLIENT_SAMPLE',
    toEntityType: 'WAREHOUSE',
    toEntityId: 'WH-MAIN',
    quantity: 3,
    deliveryNote: `DN-INIT-RTN-SAD-2025-${String(maxTxNum).slice(-3)}`,
    notes: 'Client sample return to warehouse to match Excel DATA baseline',
    timestamp: new Date('2025-01-01T00:00:00.000Z')
  };

  await pool.query(`
    INSERT INTO "InventoryTransaction" (
      id, "productId", "transactionType", "fromEntityType", "fromEntityId",
      "toEntityType", "toEntityId", quantity, "deliveryNote", notes, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    newTx.id, newTx.productId, newTx.transactionType, newTx.fromEntityType, newTx.fromEntityId,
    newTx.toEntityType, newTx.toEntityId, newTx.quantity, newTx.deliveryNote, newTx.notes, newTx.timestamp
  ]);

  console.log('✅ Added return for PROD-SAD-114 to match Excel!');
  await pool.end();
}

run().catch(console.error);
