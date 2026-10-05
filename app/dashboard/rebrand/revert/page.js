import { prisma } from '@/lib/prisma';
import { getProductsSlim } from '@/app/actions/products';
import { getBrands } from '@/app/actions/brands';
import RevertRebrandClient from './RevertRebrandClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Revert Rebrand to Old Product - Inventory System',
  description: 'Restore converted rebrand stock back into original source product definition',
};

export default async function RevertRebrandPage({ searchParams }) {
  const params = await searchParams;
  const targetTxId = params?.txId || '';
  const targetDn = params?.dn || '';

  const [products, brands, rebrandTxs] = await Promise.all([
    getProductsSlim(),
    getBrands(),
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['REBRAND', 'REBRAND_OUT', 'REBRAND_IN'] },
        deliveryNote: { not: { startsWith: 'REV-' } },
        OR: [
          { returnStatus: null },
          { returnStatus: { not: 'REVERTED' } },
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
        },
        serialNumbers: {
          select: {
            serialNumber: {
              select: {
                id: true,
                barcode: true,
                status: true,
                replaces: {
                  select: {
                    id: true,
                    barcode: true,
                    product: { select: { id: true, name: true } }
                  }
                },
                replacedBy: {
                  select: {
                    id: true,
                    barcode: true,
                    product: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 150
    })
  ]);

  let selectedTx = rebrandTxs.find(tx => tx.id === targetTxId || (targetDn && tx.deliveryNote === targetDn));

  if (!selectedTx && (targetTxId || targetDn)) {
    const directTx = await prisma.inventoryTransaction.findFirst({
      where: {
        OR: [
          targetTxId ? { id: targetTxId } : null,
          targetDn ? { deliveryNote: targetDn } : null
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
        },
        serialNumbers: {
          select: {
            serialNumber: {
              select: {
                id: true,
                barcode: true,
                status: true,
                replaces: {
                  select: {
                    id: true,
                    barcode: true,
                    product: { select: { id: true, name: true } }
                  }
                },
                replacedBy: {
                  select: {
                    id: true,
                    barcode: true,
                    product: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (directTx) {
      selectedTx = directTx;
      if (!rebrandTxs.some(t => t.id === directTx.id)) {
        rebrandTxs.unshift(directTx);
      }
    }
  }

  if (!selectedTx && rebrandTxs.length > 0) {
    selectedTx = rebrandTxs[0];
  }

  const serializedRebrandTxs = rebrandTxs.map(tx => ({
    ...tx,
    timestamp: tx.timestamp ? tx.timestamp.toISOString() : null,
  }));

  const initialSelectedTx = selectedTx ? {
    ...selectedTx,
    timestamp: selectedTx.timestamp ? selectedTx.timestamp.toISOString() : null,
  } : null;

  return (
    <RevertRebrandClient
      products={products}
      brands={brands}
      transactions={serializedRebrandTxs}
      initialSelectedTx={initialSelectedTx}
      initialTxId={targetTxId}
      initialDn={targetDn}
    />
  );
}
