const { Pool } = require('pg');
const { PrismaClient } = require('../generated/prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function run() {
  const payload = {
    fromEntityType: 'WAREHOUSE',
    fromEntityId: null,
    toEntityType: 'STORE',
    toEntityId: 'STR-SAD-0001', // AL HOOTH CENTER - RAK
    deliverySupervisorId: 'SUP-SAD-057', // Vineeth
    globalNotes: '',
    transactionDate: null,
    items: [
      { productId: 'PROD-SAD-090', quantity: 2, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-091', quantity: 1, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-092', quantity: 1, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-094', quantity: 6, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-095', quantity: 0.125, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-096', quantity: 3, barcodes: [], notes: undefined },
      { productId: 'PROD-SAD-098', quantity: 12, barcodes: [], notes: undefined }
    ]
  };

  const {
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    deliverySupervisorId,
    globalNotes = '',
    transactionDate,
    items = [],
  } = payload;

  console.log("1. Batch product query...");
  const productIds = [...new Set(items.map(i => i.productId))];
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { brand: { select: { name: true } } }
  });
  const productsMap = new Map(dbProducts.map(p => [p.id, p]));

  console.log("2. Validate products...");
  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`);
  }

  console.log("3. Items by brand...");
  const itemsByBrand = {};
  for (const item of items) {
    const product = productsMap.get(item.productId);
    const brandName = product?.brand?.name || 'General';
    if (!itemsByBrand[brandName]) {
      itemsByBrand[brandName] = [];
    }
    itemsByBrand[brandName].push(item);
  }

  console.log("4. Simulating transaction creation...");
  // Let's test inside a transaction rollbacked or test create
  await prisma.$transaction(async (tx) => {
    for (const [brandName, brandItems] of Object.entries(itemsByBrand)) {
      // Simulate ref generation
      const deliveryNote = "DN-SAD-041026-999";
      for (let idx = 0; idx < brandItems.length; idx++) {
        const item = brandItems[idx];
        const { productId, quantity, barcodes = [], notes, promoterAssignment } = item;
        const product = productsMap.get(productId);

        let finalToEntityType = toEntityType;
        let finalToEntityId = toEntityId;

        const invTx = await tx.inventoryTransaction.create({
          data: {
            productId,
            transactionType: 'ISSUE',
            fromEntityType,
            fromEntityId: fromEntityId || null,
            toEntityType: finalToEntityType,
            toEntityId: finalToEntityId || null,
            quantity,
            deliveryNote,
            receivedBy: null,
            notes: notes || null,
            deliveryStatus: 'Delivered',
            deliverySupervisorId: deliverySupervisorId || null,
            manufactureDate: null,
            expiryDate: null,
          },
        });
        console.log(`Created invTx for ${product.name}: ${invTx.id}`);

        if (finalToEntityType === 'STORE' && finalToEntityId) {
          await tx.brand.update({
            where: { id: product.brandId },
            data: {
              stores: {
                connect: { id: finalToEntityId }
              }
            }
          });
        }
      }
    }
    throw new Error("ROLLBACK_TEST_SUCCESS");
  }).catch(err => {
    if (err.message === "ROLLBACK_TEST_SUCCESS") {
      console.log("SUCCESS! All 7 items transaction logic passed cleanly in test!");
    } else {
      console.error("ERROR IN TRANSACTION LOGIC:", err);
    }
  });

  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  prisma.$disconnect();
});
