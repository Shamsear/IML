const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const txRes = await pool.query(`
    SELECT t.id, t."deliveryNote", t."transactionType", t."fromEntityId", t."toEntityId", t.notes, t."deliverySupervisorId", t."receivedBy", p.name as product_name, p.size as product_size
    FROM "InventoryTransaction" t
    LEFT JOIN "Product" p ON t."productId" = p.id
    WHERE t."deliveryNote" = 'RET-SAD-041026-007' OR t.id = 'TXN-SAD-000450' OR t.notes LIKE '%041026-007%' OR t.notes LIKE '%000450%'
  `);
  console.log('--- Transactions ---');
  console.log(txRes.rows);

  const allocRes = await pool.query(`
    SELECT a.id, a.ref, a."staffId", a."storeId", a."workingPeriod", a."notes", a."allocatedItems", s.name as staff_name, s.phone as staff_phone, s."shirtSize" as staff_size, st.name as store_name
    FROM "StaffUniformAllocation" a
    LEFT JOIN "Staff" s ON a."staffId" = s.id
    LEFT JOIN "Store" st ON a."storeId" = st.id
    ORDER BY a."createdAt" DESC
    LIMIT 10
  `);
  console.log('--- Recent Staff Allocations ---');
  console.log(allocRes.rows);

  await pool.end();
}

run().catch(console.error);
