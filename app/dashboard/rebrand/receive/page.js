import { prisma } from '@/lib/prisma';
import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReceiveRebrandClient from './ReceiveRebrandClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Receive Rebranded Stock - Inventory System',
  description: 'Receive converted rebrand stock from vendor into warehouse',
};

export default async function ReceiveRebrandPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session?.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    redirect('/dashboard/rebrand');
  }

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
        deliveryNote: { not: { startsWith: 'REV-' } },
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

  // If a specific txId or dn was passed but isn't in pendingTxs, fetch it directly
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

  // If no tx was explicitly specified, pick the first pending transaction if available
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
    <ReceiveRebrandClient
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
