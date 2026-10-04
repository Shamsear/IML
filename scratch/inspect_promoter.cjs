const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function inspect() {
  const tx = await prisma.transaction.findFirst({
    where: {
      deliveryNote: 'RET-SAD-041026-007'
    },
    include: {
      items: {
        include: {
          product: true,
          uniformAllocations: {
            include: {
              promoter: true,
              store: true,
              supervisor: true
            }
          }
        }
      },
      uniformAllocations: {
        include: {
          promoter: true,
          store: true,
          supervisor: true
        }
      },
      store: true,
      supervisor: true
    }
  });

  console.log('Transaction:', JSON.stringify(tx, null, 2));

  // Also search if there are other transactions with this DN or if items have notes or parent transaction
  const allTxs = await prisma.transaction.findMany({
    where: {
      OR: [
        { deliveryNote: { contains: 'RET-SAD-041026-007' } },
        { notes: { contains: 'TXN-SAD-000450' } },
        { id: 'TXN-SAD-000450' }
      ]
    },
    include: {
      items: {
        include: {
          product: true,
          uniformAllocations: {
            include: {
              promoter: true
            }
          }
        }
      },
      uniformAllocations: {
        include: {
          promoter: true
        }
      }
    }
  });

  console.log('All matching transactions count:', allTxs.length);
  for (const t of allTxs) {
    console.log('TX ID:', t.id, 'DN:', t.deliveryNote, 'type:', t.type, 'notes:', t.notes);
    console.log('Items:', t.items.map(i => ({ name: i.product?.name, notes: i.notes, qty: i.quantity, uniformAllocations: i.uniformAllocations })));
    console.log('TX UniformAllocations:', t.uniformAllocations);
  }
}

inspect().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
