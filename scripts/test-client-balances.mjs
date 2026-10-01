import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const txs = await pool.query(`
    SELECT t."productId", t."transactionType", t."toEntityType", t."toEntityId", t."fromEntityType", t."fromEntityId", t.quantity,
           p.name as prod_name, p."itemCode", p.category, b.id as brand_id, b.name as brand_name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    WHERE t."transactionType" IN ('CLIENT_STOCK', 'CLIENT_RETURN')
       OR t."toEntityType" IN ('CLIENT', 'BRAND')
       OR t."fromEntityType" IN ('CLIENT', 'BRAND')
    ORDER BY t.timestamp ASC
  `);

  console.log('Total client matching transactions:', txs.rows.length);

  const balances = {};
  for (const tx of txs.rows) {
    const isToClient = tx.transactionType === 'CLIENT_STOCK' || 
                       tx.toEntityType === 'BRAND' || 
                       tx.toEntityType === 'CLIENT' || 
                       (tx.transactionType === 'CLIENT_RETURN' && tx.toEntityType !== 'WAREHOUSE');
    
    const isReturnFromClient = (tx.transactionType === 'RETURN' && (tx.fromEntityType === 'CLIENT' || tx.fromEntityType === 'BRAND')) ||
                               (tx.transactionType === 'CLIENT_RETURN' && tx.toEntityType === 'WAREHOUSE');

    const brandId = tx.brand_id || 'BRND-SADIA';
    const prodId = tx.productId;
    const key = `${brandId}_${prodId}`;

    if (!balances[key]) {
      balances[key] = {
        brandId,
        brandName: tx.brand_name || 'Sadia',
        productId: prodId,
        productName: tx.prod_name,
        itemCode: tx.itemCode,
        category: tx.category,
        quantity: 0
      };
    }

    const qtyChange = isToClient ? Number(tx.quantity) : (isReturnFromClient ? -Number(tx.quantity) : 0);
    balances[key].quantity += qtyChange;
  }

  const active = Object.values(balances).filter(b => b.quantity > 0);
  console.log(`\nTotal Active Client Balances: ${active.length}`);
  console.table(active);

  await pool.end();
}

run().catch(console.error);
