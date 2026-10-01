import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const txTypes = await pool.query(`
    SELECT "transactionType", COUNT(*) as count
    FROM "InventoryTransaction"
    GROUP BY "transactionType"
    ORDER BY count DESC
  `);
  console.log('Distinct transaction types in database:');
  console.table(txTypes.rows);

  // Let's also check server-side computeWarehouseStockMap logic:
  // For each product, sum RECEIVE/RETURN/REBRAND_IN into WAREHOUSE minus ISSUE/DAMAGE/LOST/REBRAND_OUT from WAREHOUSE
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name, p."isSerialized", p."trackExpiry"
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY p.name ASC
  `);

  const allTx = await pool.query(`
    SELECT "productId", "transactionType", quantity, "fromEntityType", "toEntityType", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    ORDER BY timestamp ASC
  `);

  const productTxMap = new Map();
  for (const t of allTx.rows) {
    if (!productTxMap.has(t.productId)) productTxMap.set(t.productId, []);
    productTxMap.get(t.productId).push(t);
  }

  const negativeList = [];

  for (const p of products.rows) {
    const txList = productTxMap.get(p.id) || [];
    
    // Server-side warehouse calculation
    let whStockServer = 0;
    let totalPurchased = 0;
    let totalIssued = 0;
    let totalUsed = 0;
    let totalDamage = 0;
    let totalLost = 0;
    let totalWithClient = 0;
    let totalRebrand = 0;

    for (const t of txList) {
      const qty = Number(t.quantity) || 0;
      const type = t.transactionType;

      if (['RECEIVE', 'REC'].includes(type)) {
        totalPurchased += qty;
      }

      // Warehouse movements
      if (t.toEntityType === 'WAREHOUSE' && ['RECEIVE', 'RETURN', 'REBRAND_IN', 'REC', 'RET', 'REB_IN'].includes(type)) {
        whStockServer += qty;
      }
      if (t.fromEntityType === 'WAREHOUSE' && ['ISSUE', 'DAMAGE', 'LOST', 'REBRAND_OUT', 'REBRAND', 'OUT', 'DAM', 'LST', 'REB_OUT'].includes(type)) {
        whStockServer -= qty;
      }

      if (['ISSUE', 'OUT'].includes(type)) {
        if (t.toEntityType === 'STORE' || t.toEntityType === 'SUPERVISOR') totalIssued += qty;
        else if (t.toEntityType === 'STAFF') totalUsed += qty;
        else if (t.toEntityType === 'CLIENT' || t.toEntityType === 'BRAND') totalWithClient += qty;
      }
      if (['RETURN', 'RET'].includes(type)) {
        if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') totalIssued -= qty;
        else if (t.fromEntityType === 'STAFF') totalUsed -= qty;
        else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') totalWithClient -= qty;
      }
      if (['DAMAGE', 'DAM'].includes(type)) totalDamage += qty;
      if (['LOST', 'LST'].includes(type)) totalLost += qty;
      if (['REBRAND_OUT', 'REBRAND', 'REB_OUT'].includes(type)) totalRebrand += qty;
    }

    if (whStockServer < 0 || totalPurchased === 0 && txList.length > 0) {
      negativeList.push({
        id: p.id,
        itemCode: p.itemCode,
        name: p.name,
        brand: p.brand_name,
        whStockServer,
        totalPurchased,
        totalIssued,
        totalUsed,
        totalDamage,
        totalLost,
        totalWithClient,
        totalRebrand,
        txList
      });
    }
  }

  console.log(`\nFound ${negativeList.length} products with whStock < 0 or tx without purchase:`);
  for (const item of negativeList) {
    console.log(`\n================================================================`);
    console.log(`Product: [${item.itemCode || item.id}] "${item.name}" (Brand: ${item.brand})`);
    console.log(`Server WH Stock: ${item.whStockServer} | Purchased: ${item.totalPurchased} | Issued: ${item.totalIssued} | Damage: ${item.totalDamage} | Rebrand: ${item.totalRebrand}`);
    console.log(`Transactions (${item.txList.length}):`);
    for (const t of item.txList) {
      const dt = new Date(t.timestamp).toISOString().slice(0, 10);
      console.log(`  - [${dt}] [${t.transactionType}] Qty: ${t.quantity} | From: ${t.fromEntityType} -> To: ${t.toEntityType} | DN: ${t.deliveryNote || '-'} | Notes: ${t.notes || ''}`);
    }
  }

  await pool.end();
}

run().catch(console.error);
