const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const query = `
    SELECT id, name, category, "trackExpiry", "isSerialized", "isReturnable", "isDisposable", "brandId"
    FROM "Product"
    WHERE name ILIKE '%Napkin%'
       OR name ILIKE '%Kitchen Tissue%'
       OR name ILIKE '%PE Gloves%'
       OR name ILIKE '%Tooth Picks%'
       OR name ILIKE '%Bin Liner%'
       OR name ILIKE '%Aluminium container%'
       OR name ILIKE '%Superson%'
  `;
  const res = await pool.query(query);
  console.log('Selected Products details:', JSON.stringify(res.rows, null, 2));

  const prodIds = res.rows.map(r => r.id);
  
  // Calculate warehouse stock for these products
  const stockQuery = `
    SELECT "productId",
      SUM(CASE WHEN "toEntityType" = 'WAREHOUSE' THEN quantity ELSE 0 END) -
      SUM(CASE WHEN "fromEntityType" = 'WAREHOUSE' THEN quantity ELSE 0 END) AS "warehouseStock"
    FROM "InventoryTransaction"
    WHERE "productId" = ANY($1)
    GROUP BY "productId"
  `;
  const stockRes = await pool.query(stockQuery, [prodIds]);
  console.log('Stock breakdown:', JSON.stringify(stockRes.rows, null, 2));

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
