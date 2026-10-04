const { PrismaClient } = require('../generated/prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'Sadia' }
    },
    select: { id: true, name: true, category: true, trackExpiry: true, isSerialized: true, brandId: true }
  });
  console.log("Found products count:", products.length);
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
    console.log(`Matched for '${name}':`, matched);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
