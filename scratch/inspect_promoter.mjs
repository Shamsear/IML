import 'dotenv/config';
import prisma from '../lib/prisma.js';

async function inspect() {
  const txs = await prisma.inventoryTransaction.findMany({
    where: {
      OR: [
        { deliveryNote: 'RET-SAD-041026-007' },
        { id: 'TXN-SAD-000450' },
        { notes: { contains: '041026-007' } },
        { notes: { contains: '000450' } }
      ]
    },
    include: {
      product: true,
      deliverySupervisor: true
    }
  });

  console.log(`Found ${txs.length} transactions:`);
  for (const t of txs) {
    console.log('---');
    console.log('ID:', t.id);
    console.log('Type:', t.transactionType);
    console.log('DN:', t.deliveryNote);
    console.log('From:', t.fromEntityType, t.fromEntityId);
    console.log('To:', t.toEntityType, t.toEntityId);
    console.log('Product:', t.product?.name, 'Size:', t.product?.size);
    console.log('Notes:', t.notes);
    console.log('ReturnNotes:', t.returnNotes);
    console.log('Supervisor:', t.deliverySupervisor?.name);
  }

  // Also check StaffUniformAllocation
  const allocs = await prisma.staffUniformAllocation.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      staff: true,
      store: true,
      supervisor: true
    }
  });

  console.log(`\nFound ${allocs.length} recent staff uniform allocations:`);
  for (const a of allocs) {
    console.log('Alloc ID:', a.id, 'Ref:', a.ref);
    console.log('Staff / Promoter:', a.staff?.name, 'Phone:', a.staff?.phone, 'Size:', a.staff?.shirtSize);
    console.log('Store:', a.store?.name);
    console.log('Items:', JSON.stringify(a.allocatedItems));
    console.log('Period:', a.workingPeriod);
    console.log('Notes:', a.notes);
  }
}

inspect().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
