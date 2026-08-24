import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { DeliveryNoteDocument, formatDate } from '@/lib/pdf/deliveryNote';

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
        transactionType: 'DAMAGE',
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
      return new NextResponse('No matching damage transactions found.', { status: 404 });
    }

    const notes = txs[0]?.notes?.split(' | ')[0] || '';

    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const parsedItemNotes = tx.notes?.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          name: prod.name, isSerialized: prod.isSerialized,
          quantity: 0, serials: [], notes: parsedItemNotes
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
    const docNo = dnQuery === 'UNASSIGNED' ? `IML-DAM-${dateQuery.replace(/-/g, '')}` : dnQuery;
    const dateStr = formatDate(dateQuery);

    const pdfStream = await renderToStream(
      <DeliveryNoteDocument
        title="DAMAGE NOTE"
        brandName={brandName}
        inventory={inventory}
        dateStr={dateStr}
        docNo={docNo}
        notes={notes}
        signatureLabels={[
          { label: 'REPORTED BY' },
          { label: 'VERIFIED BY' },
          { label: 'AUTHORIZED BY' },
        ]}
      />
    );

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-DamageNote-${brandName.replace(/\s+/g, '_')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Damage PDF Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
