import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.product.findMany({
    select: { category: true },
    distinct: ['category']
  });
  console.log("Categories in db:", categories);
}

main().catch(console.error).finally(() => prisma.$disconnect());
