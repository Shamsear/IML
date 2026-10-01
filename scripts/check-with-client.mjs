import fs from 'fs';
import pg from 'pg';
import { getProductStock } from '../lib/stock.js';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, p.category, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT t.id, t."productId", t."transactionType", t.quantity, t."fromEntityType", t."fromEntityId", 
           t."toEntityType", t."toEntityId", t."deliveryNote", t.notes, t.timestamp,
           t."receivedBy", s.name as supervisor_name
    FROM "InventoryTransaction" t
    LEFT JOIN "Supervisor" s ON t."deliverySupervisorId" = s.id
    ORDER BY t.timestamp ASC
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  const withClientProducts = [];

  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    const stock = getProductStock(txList);

    if (stock.withClient > 0) {
      const clientTxs = txList.filter(t => t.transactionType === 'CLIENT_STOCK' || t.transactionType === 'CLIENT_RETURN');
      withClientProducts.push({
        itemCode: p.itemCode,
        name: p.name,
        category: p.category,
        withClient: stock.withClient,
        warehouse: stock.warehouse,
        purchased: stock.purchased,
        transactions: clientTxs.map(t => ({
          dn: t.deliveryNote,
          qty: t.quantity,
          notes: t.notes,
          receivedBy: t.receivedBy,
          supervisor: t.supervisor_name,
          date: t.timestamp ? new Date(t.timestamp).toISOString().split('T')[0] : 'N/A'
        }))
      });
    }
  }

  console.log(`\n==================================================`);
  console.log(`📦 TOTAL PRODUCTS WITH CLIENT: ${withClientProducts.length}`);
  console.log(`==================================================\n`);

  for (const item of withClientProducts) {
    console.log(`🔹 [${item.itemCode}] ${item.name} (${item.category})`);
    console.log(`   With Client Qty: ${item.withClient} | Warehouse: ${item.warehouse} | Purchased: ${item.purchased}`);
    if (item.transactions.length > 0) {
      console.log(`   Transactions (${item.transactions.length}):`);
      for (const t of item.transactions) {
        console.log(`     - Date: ${t.date} | DN: ${t.dn} | Qty: ${t.qty} | Notes: ${t.notes || 'None'} | By: ${t.receivedBy || 'N/A'} | Sup: ${t.supervisor || 'N/A'}`);
      }
    }
    console.log('');
  }

  await pool.end();
}

run().catch(console.error);
