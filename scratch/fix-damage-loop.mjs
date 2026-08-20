import fs from 'fs';

const filePath = 'app/actions/transactions.js';
let content = fs.readFileSync(filePath, 'utf8');

// The broken for-loop body starts at the for loop line (1096) and the actual body begins
// with orphaned code from line 1097. We need to replace lines 1096-1181 with the correct block.

const lines = content.split('\n');

// Find the exact for-loop line (0-indexed)
const forLineIdx = lines.findIndex((l, i) => i >= 1090 && l.includes('for (const item of items) {'));
if (forLineIdx === -1) {
  console.error('Could not find for loop line');
  process.exit(1);
}

// Find the end of the loop: "createdTxs.push(invTx);" then "    }"
let endIdx = -1;
for (let i = forLineIdx; i < lines.length; i++) {
  if (lines[i].includes('createdTxs.push(invTx);')) {
    // The closing brace should be the next non-empty line
    endIdx = i + 1;
    // skip past "    }"
    while (endIdx < lines.length && lines[endIdx].trim() !== '}') endIdx++;
    break;
  }
}

if (endIdx === -1) {
  console.error('Could not find end of for loop');
  process.exit(1);
}

console.log(`For loop starts at line ${forLineIdx + 1}, ends at line ${endIdx + 1}`);
console.log('Loop start line:', lines[forLineIdx]);
console.log('Loop end line:', lines[endIdx]);

// The correct replacement (CRLF to match rest of file)
const correctLoop = `    for (const item of items) {\r
      const { productId, quantity, barcodes = [], notes } = item;\r
\r
      if (!productId) throw new Error('Product ID is required for all items');\r
      if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0 for all items');\r
\r
      const product = await tx.product.findUnique({\r
        where: { id: productId },\r
        include: { brand: { select: { name: true } } },\r
      });\r
\r
      if (!product) throw new Error(\`Product not found for ID: \${productId}\`);\r
\r
      const brandName = product.brand?.name || 'General';\r
      const typeCode = resolvedType === 'LOST' ? 'LST' : 'DMG';\r
      const deliveryNote = await generateCustomRef(tx, typeCode, brandName);\r
\r
      // Verify stock levels for bulk (non-serialized) products\r
      if (!product.isSerialized && fromEntityType) {\r
        const inboundSum = await tx.inventoryTransaction.aggregate({\r
          where: {\r
            productId,\r
            toEntityType: fromEntityType,\r
            toEntityId: fromEntityId || null,\r
          },\r
          _sum: { quantity: true },\r
        });\r
\r
        const outboundSum = await tx.inventoryTransaction.aggregate({\r
          where: {\r
            productId,\r
            fromEntityType: fromEntityType,\r
            fromEntityId: fromEntityId || null,\r
          },\r
          _sum: { quantity: true },\r
        });\r
\r
        const inQty = inboundSum._sum.quantity || 0;\r
        const outQty = outboundSum._sum.quantity || 0;\r
        const currentStock = inQty - outQty;\r
\r
        if (currentStock < quantity) {\r
          throw new Error(\`Insufficient stock for product "\${product.name}". Current stock at \${fromEntityType} is \${currentStock}, requested \${quantity}.\`);\r
        }\r
      }\r
\r
      // A. Create core transaction\r
      const invTx = await tx.inventoryTransaction.create({\r
        data: {\r
          productId,\r
          transactionType: resolvedType,\r
          fromEntityType,\r
          fromEntityId: fromEntityId || null,\r
          toEntityType: null,\r
          toEntityId: null,\r
          quantity,\r
          notes: notes || \`Bulk \${resolvedType.toLowerCase()} logged\`,\r
          deliveryStatus: 'Delivered',\r
          deliveryNote,\r
        },\r
      });\r
\r
      // B. Link serialized serials and mark as DAMAGED/LOST\r
      if (product.isSerialized && barcodes.length > 0) {\r
        const dbSerials = await tx.productSerialNumber.findMany({\r
          where: {\r
            productId,\r
            barcode: { in: barcodes },\r
          },\r
        });\r
\r
        if (dbSerials.length !== barcodes.length) {\r
          throw new Error(\`Some barcodes for product "\${product.name}" could not be found in the database.\`);\r
        }\r
\r
        if (fromEntityType) {\r
          const invalidSerials = dbSerials.filter(\r
            (s) => s.currentLocationType !== fromEntityType || s.currentLocationId !== fromEntityId\r
          );\r
          if (invalidSerials.length > 0) {\r
            throw new Error(\`Some barcodes for "\${product.name}" are not present at the source location (\${fromEntityType}).\`);\r
          }\r
        }\r
\r
        // Bulk mark serial records as DAMAGED or LOST\r
        await tx.productSerialNumber.updateMany({\r
          where: {\r
            id: { in: dbSerials.map(s => s.id) }\r
          },\r
          data: {\r
            status: serialStatus,\r
            currentLocationType: null,\r
            currentLocationId: null,\r
          }\r
        });\r
\r
        // Bulk insert the transaction-serial mappings\r
        await tx.transactionSerialNumber.createMany({\r
          data: dbSerials.map(serial => ({\r
            transactionId: invTx.id,\r
            serialNumberId: serial.id,\r
          }))\r
        });\r
      }\r
\r
      createdTxs.push(invTx);\r
    }`;

// Replace lines from forLineIdx to endIdx (inclusive)
const before = lines.slice(0, forLineIdx);
const after = lines.slice(endIdx + 1);
const newContent = [...before, correctLoop, ...after].join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Done! File patched successfully.');
