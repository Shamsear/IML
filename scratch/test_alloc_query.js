const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const dnQuery = 'RET-SAD-041026-007';
  
  // 1. Get transactions
  const txRes = await pool.query(`
    SELECT t.*, p.name as product_name, p.category as product_category, p.size as product_size, p."isSerialized"
    FROM "InventoryTransaction" t
    LEFT JOIN "Product" p ON t."productId" = p.id
    WHERE t."deliveryNote" = $1
  `, [dnQuery]);

  console.log('Found transactions:', txRes.rows);

  const tx = txRes.rows[0];
  const storeId = (tx?.fromEntityType === 'STORE' ? tx.fromEntityId : null) || (tx?.toEntityType === 'STORE' ? tx.toEntityId : null) || (tx?.fromEntityId?.startsWith('STR-') ? tx.fromEntityId : null);

  console.log('Resolved storeId:', storeId);

  // 2. Check orig Tx
  const match = tx?.notes?.match(/from Outbound ([a-zA-Z0-9-_.]+)/);
  let origDn = null;
  if (match && match[1]) {
    const origRes = await pool.query(`SELECT * FROM "InventoryTransaction" WHERE id = $1 OR "deliveryNote" = $1`, [match[1]]);
    console.log('Original TX:', origRes.rows);
    origDn = origRes.rows[0]?.deliveryNote;
  }

  // 3. Find allocations
  const allocRes = await pool.query(`
    SELECT a.*, s.name as staff_name, s.phone as staff_phone, s."shirtSize" as staff_size, st.name as store_name
    FROM "StaffUniformAllocation" a
    LEFT JOIN "Staff" s ON a."staffId" = s.id
    LEFT JOIN "Store" st ON a."storeId" = st.id
    WHERE a.ref = $1 OR ( $2::text IS NOT NULL AND a.ref = $2 ) OR ( $3::text IS NOT NULL AND a."storeId" = $3 )
    ORDER BY a."createdAt" DESC
  `, [dnQuery, origDn, storeId]);

  console.log('Matching allocations:', allocRes.rows);

  await pool.end();
}

run().catch(console.error);
