import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { DeliveryNoteDocument, formatDate } from '@/lib/pdf/deliveryNote';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');
    const brandIdQuery = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn');

    if (!dateQuery || !brandIdQuery || !dnQuery) {
      return new NextResponse('Missing required parameters: date, brandId, dn', { status: 400 });
    }

    const brandObj = await prisma.brand.findUnique({ where: { id: brandIdQuery } });
    const brandName = brandObj?.name || 'N/A';

    const dayStart = new Date(`${dateQuery}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateQuery}T23:59:59.999Z`);

    const txs = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'LOST',
        deliveryNote: dnQuery === 'UNASSIGNED' ? null : dnQuery,
        timestamp: { gte: dayStart, lte: dayEnd },
        product: { brandId: brandIdQuery }
      },
      include: {
        product: true,
        serialNumbers: { include: { serialNumber: true } }
      }
    });

    if (txs.length === 0) {
      return new NextResponse('No matching loss transactions found.', { status: 404 });
    }

    let sourceName = 'IML Central Warehouse';
    if (txs[0]?.fromEntityType === 'STORE' && txs[0]?.fromEntityId) {
      const storeObj = await prisma.store.findUnique({ where: { id: txs[0].fromEntityId } });
      sourceName = storeObj ? `Store: ${storeObj.name}` : `Store: ${txs[0].fromEntityId}`;
    } else if (txs[0]?.fromEntityType === 'STAFF' || txs[0]?.fromEntityType === 'DIRECT') {
      sourceName = `Promoter / Staff: ${txs[0].fromEntityId || 'N/A'}`;
    }

    const notes = txs[0]?.notes?.split(' | ')[0] || '';

    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const parsedItemNotes = tx.notes?.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          name: prod.name,
          imageUrl: prod.imageUrl,
          isSerialized: prod.isSerialized,
          quantity: 0,
          serials: [],
          notes: parsedItemNotes
        };
      }
      productGroups[prod.id].quantity += tx.quantity;
      if (prod.isSerialized && tx.serialNumbers) {
        tx.serialNumbers.forEach(sn => {
          productGroups[prod.id].serials.push({ barcode: sn.serialNumber.barcode });
        });
      }
    }

    const inventory = Object.values(productGroups);
    const docNo = dnQuery === 'UNASSIGNED' ? `IML-LOS-${dateQuery.replace(/-/g, '')}` : dnQuery;
    const dateStr = formatDate(dateQuery);
    const showImages = searchParams.get('images') === '1' || searchParams.get('images') === 'true' || searchParams.get('showImages') === 'true';

    const pdfBuffer = await renderToBuffer(
      <DeliveryNoteDocument
        title="LOSS NOTE"
        brandName={brandName}
        supplierName={sourceName}
        inventory={inventory}
        dateStr={dateStr}
        docNo={docNo}
        notes={notes}
        showImages={showImages}
        signatureLabels={[
          { label: 'REPORTED BY' },
          { label: 'VERIFIED BY' },
          { label: 'AUTHORIZED BY' },
        ]}
      />
    );

    const safeBrand = (brandName || 'LossNote').replace(/[^a-zA-Z0-9_-]/g, '_');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-LossNote-${safeBrand}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (error) {
    console.error('[Loss PDF Generation Error]:', error);
    return new NextResponse(`Error generating PDF: ${error.message || 'Internal Server Error'}`, { status: 500 });
  }
}
