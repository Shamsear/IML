const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany();
  console.log("Brands:", brands.map(b => ({
    id: b.id,
    name: b.name,
    secretKey: b.secretKey
  })));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
