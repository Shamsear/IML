const { Client } = require('pg');

// Load environment variables from .env
require('dotenv').config({ path: 'd:/inventory/.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database!");

    // Disable triggers temporarily if needed, but not required for clean inserts
    
    // ----------------------------------------------------
    // 1. Seed Stores
    // ----------------------------------------------------
    console.log("Inserting Stores...");
    const stores = [
      ['store-lulu-khalifa', 'Lulu Hypermarket Khalifa City', 'Abu Dhabi', 'Khalifa City, AUH', true, new Date(), new Date()],
      ['store-lulu-khalidiyah', 'Lulu Hypermarket Khalidiyah Mall', 'Abu Dhabi', 'Al Khalidiyah, AUH', true, new Date(), new Date()],
      ['store-carrefour-airport', 'Carrefour Airport Road', 'Abu Dhabi', 'Airport Road, AUH', true, new Date(), new Date()]
    ];

    for (const store of stores) {
      await client.query(`
        INSERT INTO "Store" (id, name, region, location, "isPublic", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, region = EXCLUDED.region, location = EXCLUDED.location
      `, store);
    }

    // ----------------------------------------------------
    // 2. Seed Brands
    // ----------------------------------------------------
    console.log("Inserting Brands...");
    const brands = [
      ['brand-sadia', 'Sadia', 'Sadia Brand POSM & Promotional inventory', null, true, 'sadia-portal-key-2026-auth-001', new Date(), new Date()],
      ['brand-virgin', 'Virgin Mobile', 'Virgin Mobile SIM Cards & Router equipment', null, true, 'virgin-portal-key-2026-auth-002', new Date(), new Date()],
      ['brand-sopexa', 'Sopexa', 'Sopexa Catering equipment & Uniform inventories', null, true, 'sopexa-portal-key-2026-auth-003', new Date(), new Date()]
    ];

    for (const brand of brands) {
      await client.query(`
        INSERT INTO "Brand" (id, name, description, "imageUrl", "isPublic", "secretKey", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, description = EXCLUDED.description, "secretKey" = EXCLUDED."secretKey"
      `, brand);
    }

    // ----------------------------------------------------
    // 3. Link Brands to Stores
    // ----------------------------------------------------
    console.log("Linking Brands to Stores...");
    const relations = [
      ['brand-sadia', 'store-lulu-khalifa'],
      ['brand-sadia', 'store-lulu-khalidiyah'],
      ['brand-virgin', 'store-carrefour-airport'],
      ['brand-virgin', 'store-lulu-khalifa'],
      ['brand-sopexa', 'store-lulu-khalidiyah'],
      ['brand-sopexa', 'store-carrefour-airport']
    ];

    for (const rel of relations) {
      await client.query(`
        INSERT INTO "_BrandToStore" ("A", "B")
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, rel);
    }

    // ----------------------------------------------------
    // 4. Seed Products
    // ----------------------------------------------------
    console.log("Inserting Products...");
    const products = [
      ['prod-sad-stand', 'brand-sadia', 'SAD-WD-001', 'Sadia Wooden Stand', 'POSM', null, true, true, false, 15, new Date(), new Date()],
      ['prod-sad-counter', 'brand-sadia', 'SAD-PC-002', 'Sadia Promoter Counter', 'POSM', null, true, true, false, 8, new Date(), new Date()],
      ['prod-sad-shirt', 'brand-sadia', 'SAD-UNI-M', 'Sadia Uniform Shirt - M', 'Uniform', null, false, true, false, 20, new Date(), new Date()],
      ['prod-vrg-esim', 'brand-virgin', 'VRG-ESIM', 'Virgin eSIM 5G', 'SIM CARDS', null, false, true, true, 100, new Date(), new Date()],
      ['prod-vrg-router', 'brand-virgin', 'VRG-RTR-4G', 'Virgin 4G Router LTE', 'ROUTERS', null, true, true, true, 15, new Date(), new Date()],
      ['prod-sop-gloves', 'brand-sopexa', 'SOP-GLV-01', 'Sopexa Vinyl Gloves', 'Catering', null, false, true, false, 50, new Date(), new Date()],
      ['prod-sop-board', 'brand-sopexa', 'SOP-BRD-02', 'Sopexa Wooden Board', 'Catering', null, true, true, false, 10, new Date(), new Date()]
    ];

    for (const prod of products) {
      await client.query(`
        INSERT INTO "Product" (id, "brandId", "itemCode", name, category, "imageUrl", "isReturnable", "isPublic", "isSerialized", "stockCap", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, category = EXCLUDED.category, "stockCap" = EXCLUDED."stockCap"
      `, prod);
    }

    // ----------------------------------------------------
    // 5. Seed Transactions (Only if empty)
    // ----------------------------------------------------
    const txCheck = await client.query('SELECT COUNT(*) FROM "InventoryTransaction"');
    const txCount = parseInt(txCheck.rows[0].count, 10);

    if (txCount === 0) {
      console.log("Seeding Transactions...");
      
      // Sadia Stand Inbound
      const t1 = 'tx-sad-stand-receive';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "toEntityType", quantity, notes, timestamp)
        VALUES ($1, 'prod-sad-stand', 'RECEIVE', 'WAREHOUSE', 150, 'Inbound shipment from Sadia Supplier (LPO #9822)', $2)
      `, [t1, new Date()]);

      // Sadia Stand Issue to Store
      const t2 = 'tx-sad-stand-issue';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "fromEntityType", "toEntityType", "toEntityId", quantity, "deliveryNote", notes, timestamp)
        VALUES ($1, 'prod-sad-stand', 'ISSUE', 'WAREHOUSE', 'STORE', 'store-lulu-khalifa', 45, 'DN-SAD-8822', 'POSM placement for promoters', $2)
      `, [t2, new Date()]);

      // Sadia Stand Damage
      const t3 = 'tx-sad-stand-damage';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "fromEntityType", quantity, notes, timestamp)
        VALUES ($1, 'prod-sad-stand', 'DAMAGE', 'WAREHOUSE', 4, 'Cardboard components ripped during warehouse handling', $2)
      `, [t3, new Date()]);

      // Sopexa Gloves Inbound
      const t4 = 'tx-sop-gloves-receive';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "toEntityType", quantity, notes, timestamp)
        VALUES ($1, 'prod-sop-gloves', 'RECEIVE', 'WAREHOUSE', 500, 'Bulk purchase of catering gloves (Lot #26-01)', $2)
      `, [t4, new Date()]);

      // Sopexa Gloves Issue
      const t5 = 'tx-sop-gloves-issue';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "fromEntityType", "toEntityType", "toEntityId", quantity, "deliveryNote", timestamp)
        VALUES ($1, 'prod-sop-gloves', 'ISSUE', 'WAREHOUSE', 'STORE', 'store-lulu-khalidiyah', 120, 'DN-SOP-9911', $2)
      `, [t5, new Date()]);

      // Virgin Router Inbound
      const t6 = 'tx-vrg-router-receive';
      await client.query(`
        INSERT INTO "InventoryTransaction" (id, "productId", "transactionType", "toEntityType", quantity, notes, timestamp)
        VALUES ($1, 'prod-vrg-router', 'RECEIVE', 'WAREHOUSE', 10, 'LTE Router batch shipment (Supplier A)', $2)
      `, [t6, new Date()]);

      // ----------------------------------------------------
      // 6. Seed Serial Numbers for Virgin Router
      // ----------------------------------------------------
      console.log("Seeding Serials...");
      const barcodes = [
        'IMEI889230101', 'IMEI889230102', 'IMEI889230103', 'IMEI889230104', 'IMEI889230105',
        'IMEI889230106', 'IMEI889230107', 'IMEI889230108', 'IMEI889230109', 'IMEI889230110'
      ];

      for (let i = 0; i < barcodes.length; i++) {
        const serialId = `serial-vrg-${i}`;
        const isStore = i < 3;
        
        await client.query(`
          INSERT INTO "ProductSerialNumber" (id, "productId", barcode, status, "currentLocationType", "currentLocationId", "createdAt", "updatedAt")
          VALUES ($1, 'prod-vrg-router', $2, $3, $4, $5, $6, $7)
        `, [
          serialId,
          barcodes[i],
          isStore ? 'DISTRIBUTED_STORE' : 'AVAILABLE',
          isStore ? 'STORE' : 'WAREHOUSE',
          isStore ? 'store-carrefour-airport' : null,
          new Date(),
          new Date()
        ]);

        await client.query(`
          INSERT INTO "TransactionSerialNumber" ("transactionId", "serialNumberId")
          VALUES ($1, $2)
        `, [t6, serialId]);
      }
      
      console.log("Transactions and Serial numbers successfully seeded!");
    } else {
      console.log("Database already has transactions. Skipping transaction/serial seeding.");
    }

    console.log("Excel migration database seed completed successfully!");

  } catch (error) {
    console.error("Migration seed failed:", error);
  } finally {
    await client.end();
  }
}

main();
