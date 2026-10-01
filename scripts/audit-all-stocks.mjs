import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const products = await pool.query(`
    SELECT p.id, p."itemCode", p.name, b.name as brand_name
    FROM "Product" p
    LEFT JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY p."itemCode" ASC
  `);

  const txRes = await pool.query(`
    SELECT id, "productId", "transactionType", quantity, "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "returnStatus", "deliveryNote", notes, timestamp
    FROM "InventoryTransaction"
    ORDER BY timestamp ASC
  `);

  const txByProduct = new Map();
  for (const t of txRes.rows) {
    if (!txByProduct.has(t.productId)) txByProduct.set(t.productId, []);
    txByProduct.get(t.productId).push(t);
  }

  const results = [];

  for (const p of products.rows) {
    const txList = txByProduct.get(p.id) || [];
    
    let purchased = 0;
    let warehouse = 0;
    let issued = 0;
    let used = 0;
    let damage = 0;
    let lost = 0;
    let withClient = 0;
    let rebrand = 0;

    for (const t of txList) {
      const qty = Number(t.quantity) || 0;
      const type = t.transactionType;

      if (type === 'RECEIVE') {
        purchased += qty;
        warehouse += qty;
      } else if (type === 'ISSUE') {
        if (t.fromEntityType === 'STORE') {
          issued -= qty;
          if (t.toEntityType === 'STAFF') used += qty;
        } else {
          warehouse -= qty;
          if (t.toEntityType === 'STORE' || t.toEntityType === 'SUPERVISOR') issued += qty;
          else if (t.toEntityType === 'STAFF') used += qty;
          else if (t.toEntityType === 'CLIENT' || t.toEntityType === 'BRAND') withClient += qty;
        }
      } else if (type === 'CLIENT_STOCK') {
        warehouse -= qty;
        withClient += qty;
      } else if (type === 'CLIENT_RETURN') {
        warehouse -= qty;
        withClient += qty;
      } else if (type === 'RETURN') {
        if (t.toEntityType === 'VENDOR') {
          warehouse -= qty;
          purchased -= qty;
        } else {
          warehouse += qty;
          if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
          else if (t.fromEntityType === 'STAFF') used -= qty;
          else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
        }
      } else if (type === 'DAMAGE') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        damage += qty;
      } else if (type === 'LOST') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        lost += qty;
      } else if (type === 'REBRAND' || type === 'REBRAND_OUT') {
        warehouse -= qty;
        rebrand += qty;
      } else if (type === 'REBRAND_IN') {
        warehouse += qty;
      } else if (type === 'USED') {
        if (t.fromEntityType === 'STORE') issued -= qty;
        else if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        used += qty;
      }
    }

    results.push({
      itemCode: p.itemCode,
      name: p.name,
      brand: p.brand_name,
      purchased,
      warehouse,
      issued,
      used,
      damage,
      lost,
      withClient,
      rebrand,
      txCount: txList.length
    });
  }

  const negativeWarehouse = results.filter(r => r.warehouse < 0 || r.issued < 0 || (r.purchased === 0 && r.txCount > 0));
  console.log(`\n=== PRODUCTS WITH NEGATIVE BALANCES OR ISSUES WITHOUT PURCHASE (${negativeWarehouse.length}) ===`);
  console.table(negativeWarehouse);

  await pool.end();
}

run().catch(console.error);
