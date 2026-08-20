import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

async function main() {
  // Find products matching keychain
  const prodRes = await pool.query('SELECT id, name FROM "Product" WHERE name ILIKE \'%key%\' OR name ILIKE \'%chain%\'');
  console.log("Keychain Products:", prodRes.rows);

  if (prodRes.rows.length > 0) {
    const pId = prodRes.rows[0].id;
    // Find all transactions for this product
    const txRes = await pool.query('SELECT id, "transactionType", "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", quantity, "returnStatus", "returnedQty", notes, timestamp FROM "InventoryTransaction" WHERE "productId" = $1 ORDER BY timestamp DESC', [pId]);
    console.log("Transactions:");
    console.log(txRes.rows);
  }

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
