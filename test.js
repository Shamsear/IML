const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.staff.findMany().then(console.log).finally(() => prisma.$disconnect());
