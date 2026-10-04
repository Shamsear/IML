import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, category: true, trackExpiry: true, isSerialized: true, brandId: true }
  });
  console.log("Total products count:", products.length);
  const targetNames = [
    'Napkin size 30*30',
    'Kitchen Tissue',
    'PE Gloves',
    'Tooth Picks',
    'Bin Liner Bags',
    'Aluminium container',
    'Superson Cooking'
  ];
  for (const name of targetNames) {
    const matched = products.filter(p => p.name.includes(name));
    console.log(`\n--- Matched for '${name}':`, JSON.stringify(matched, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
