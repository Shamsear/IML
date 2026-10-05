import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: 'PROD-SAD-069' },
    include: { brand: true, transactions: true }
  });
  console.log('Product:', p?.name, 'Category:', p?.category, 'isReturnable:', p?.isReturnable);
  console.log('Product transactions count:', p?.transactions?.length);
  p?.transactions?.forEach(t => {
    console.log('TX:', t.transactionType, 'qty:', t.quantity, 'from:', t.fromEntityType, t.fromEntityId, 'to:', t.toEntityType, t.toEntityId, 'dn:', t.deliveryNote, 'returnStatus:', t.returnStatus, 'returnedQty:', t.returnedQty);
  });

  const allocs = await prisma.staffUniformAllocation.findMany({
    include: { staff: true, store: true, supervisor: true }
  });
  console.log('Total allocations in DB:', allocs.length);

  const pName = (p?.name || '').toLowerCase();
  const txDns = new Set(p?.transactions?.map(t => t.deliveryNote).filter(Boolean));

  const matched = allocs.filter(a => {
    let items = [];
    if (a.allocatedItems) {
      items = typeof a.allocatedItems === 'string' ? JSON.parse(a.allocatedItems) : a.allocatedItems;
    }
    const hasItemMatch = items?.some(i => {
      if (i.productId === p.id) return true;
      if (i.type && pName.includes(i.type.toLowerCase())) return true;
      if (i.type && i.type.toLowerCase().includes(pName)) return true;
      return false;
    });
    const hasDnMatch = a.ref && txDns.has(a.ref);
    return hasItemMatch || hasDnMatch;
  });

  console.log('Matched allocations count:', matched.length);
  matched.slice(0, 5).forEach(m => {
    console.log(JSON.stringify({
      id: m.id,
      staff: m.staff?.name,
      phone: m.staff?.phone,
      shirtSize: m.staff?.shirtSize,
      store: m.store?.name,
      supervisor: m.supervisor?.name,
      workingPeriod: m.workingPeriod,
      givenDate: m.givenDate,
      returnDate: m.returnDate,
      ref: m.ref,
      uniformQty: m.uniformQty,
      capQty: m.capQty,
      uniformReturned: m.uniformReturned,
      capReturned: m.capReturned,
      allocatedItems: m.allocatedItems,
      notes: m.notes
    }, null, 2));
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
