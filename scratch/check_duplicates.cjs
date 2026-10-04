const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const query = `
    SELECT id, "deliveryNote", "productId", quantity, "toEntityType", "toEntityId", timestamp
    FROM "InventoryTransaction"
    WHERE "deliveryNote" LIKE 'DN-SAD-011026%' OR "deliveryNote" LIKE 'DN-SAD-041026%'
    ORDER BY timestamp DESC, id DESC
  `;
  const res = await pool.query(query);
  console.log('Found transactions count:', res.rows.length);

  const dns = [...new Set(res.rows.map(r => r.deliveryNote))];
  console.log('Delivery notes:', dns);

  for (const dn of dns) {
    const group = res.rows.filter(r => r.deliveryNote === dn);
    console.log(`\nDelivery Note ${dn}: ${group.length} items`);
    group.forEach(g => {
      console.log(` - ${g.id} | Prod: ${g.productId} | Qty: ${g.quantity} | To: ${g.toEntityId}`);
    });
  }

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
