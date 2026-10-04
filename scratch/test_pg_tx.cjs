const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log("Transaction STARTED");

    const items = [
      { productId: 'PROD-SAD-090', quantity: 2 },
      { productId: 'PROD-SAD-091', quantity: 1 },
      { productId: 'PROD-SAD-092', quantity: 1 },
      { productId: 'PROD-SAD-094', quantity: 6 },
      { productId: 'PROD-SAD-095', quantity: 0.125 },
      { productId: 'PROD-SAD-096', quantity: 3 },
      { productId: 'PROD-SAD-098', quantity: 12 }
    ];

    const toEntityId = 'STR-SAD-0001';
    const deliverySupervisorId = 'SUP-SAD-057';
    const deliveryNote = 'DN-SAD-041026-001';

    for (const item of items) {
      const id = 'tx-test-' + Math.random();
      const insertQuery = `
        INSERT INTO "InventoryTransaction" (
          "id", "productId", "transactionType", "fromEntityType", "fromEntityId",
          "toEntityType", "toEntityId", "quantity", "deliveryNote",
          "deliveryStatus", "deliverySupervisorId", "timestamp", "returnedQty"
        ) VALUES (
          $1, $2, 'ISSUE', 'WAREHOUSE', NULL,
          'STORE', $3, $4, $5,
          'Delivered', $6, NOW(), 0
        )
      `;
      await client.query(insertQuery, [id, item.productId, toEntityId, item.quantity, deliveryNote, deliverySupervisorId]);
      console.log(`Inserted transaction for ${item.productId}, qty=${item.quantity}`);
    }

    console.log("All 7 items inserted successfully into InventoryTransaction table!");

    await client.query('ROLLBACK');
    console.log("Rolled back test transaction cleanly.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("PG ERROR:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
