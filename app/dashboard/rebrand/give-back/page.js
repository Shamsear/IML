import { prisma } from '@/lib/prisma';
import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import GiveBackClient from './GiveBackClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Give Back Rebranded Stock - Inventory System',
  description: 'Return unconverted rebrand stock from vendor back into warehouse',
};

export default async function GiveBackPage({ searchParams }) {
  const params = await searchParams;
  const targetTxId = params?.txId || '';
  const targetDn = params?.dn || '';

  const [products, brands, stores, pendingTxs] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    prisma.store.findMany({
      select: { id: true, name: true }
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['REBRAND', 'REBRAND_OUT'] },
        OR: [
          { returnStatus: null },
          { returnStatus: 'PENDING' },
          { returnStatus: 'PARTIAL' },
        ]
      },
      select: {
        id: true,
        transactionType: true,
        fromEntityType: true,
        fromEntityId: true,
        toEntityType: true,
        toEntityId: true,
        quantity: true,
        deliveryNote: true,
        notes: true,
        returnStatus: true,
        returnedQty: true,
        timestamp: true,
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            category: true,
            imageUrl: true,
            isSerialized: true,
            trackExpiry: true,
            brand: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    })
  ]);

  const storeNames = {};
  stores.forEach(s => { storeNames[s.id] = s.name; });

  let selectedTx = pendingTxs.find(tx => tx.id === targetTxId || (targetDn && tx.deliveryNote === targetDn));

  if (!selectedTx && (targetTxId || targetDn)) {
    const directTx = await prisma.inventoryTransaction.findFirst({
      where: {
        OR: [
          targetTxId ? { id: targetTxId } : null,
          targetDn ? { deliveryNote: targetDn, transactionType: { in: ['REBRAND', 'REBRAND_OUT'] } } : null
        ].filter(Boolean)
      },
      select: {
        id: true,
        transactionType: true,
        fromEntityType: true,
        fromEntityId: true,
        toEntityType: true,
        toEntityId: true,
        quantity: true,
        deliveryNote: true,
        notes: true,
        returnStatus: true,
        returnedQty: true,
        timestamp: true,
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            category: true,
            imageUrl: true,
            isSerialized: true,
            trackExpiry: true,
            brand: { select: { id: true, name: true } }
          }
        }
      }
    });
    if (directTx) {
      selectedTx = directTx;
      if (!pendingTxs.some(t => t.id === directTx.id)) {
        pendingTxs.unshift(directTx);
      }
    }
  }

  if (!selectedTx && pendingTxs.length > 0) {
    selectedTx = pendingTxs[0];
  }

  const serializedPendingTxs = pendingTxs.map(tx => ({
    ...tx,
    timestamp: tx.timestamp ? tx.timestamp.toISOString() : null,
  }));

  const initialSelectedTx = selectedTx ? {
    ...selectedTx,
    timestamp: selectedTx.timestamp ? selectedTx.timestamp.toISOString() : null,
  } : null;

  return (
    <GiveBackClient
      products={products}
      brands={brands}
      storeNames={storeNames}
      pendingTransactions={serializedPendingTxs}
      initialSelectedTx={initialSelectedTx}
      initialTxId={targetTxId}
      initialDn={targetDn}
    />
  );
}
