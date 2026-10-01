import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const whereClause = {
    OR: [
      { transactionType: { in: ['CLIENT_STOCK', 'CLIENT_RETURN'] } },
      { toEntityType: { in: ['CLIENT', 'BRAND'] } },
      { fromEntityType: { in: ['CLIENT', 'BRAND'] } }
    ]
  };

  const txs = await pool.query(`
    SELECT t.id, t."transactionType", t.quantity, t."deliveryNote", p.name, b.name as brand_name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    WHERE t."transactionType" IN ('CLIENT_STOCK', 'CLIENT_RETURN')
       OR t."toEntityType" IN ('CLIENT', 'BRAND')
       OR t."fromEntityType" IN ('CLIENT', 'BRAND')
    ORDER BY t.timestamp DESC
  `);

  console.log(`✅ Total Transactions Visible on With Client Page: ${txs.rows.length}`);
  console.log('Top 5 transactions:');
  console.table(txs.rows.slice(0, 5));

  await pool.end();
}

run().catch(console.error);
