import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { DeliveryNoteDocument, formatDate } from '@/lib/pdf/deliveryNote';

function cleanNotes(noteStr) {
  if (!noteStr) return '';
  let cleaned = noteStr
    .replace(/Auto-generated Return from Outbound [a-zA-Z0-9-_.]+/gi, '')
    .replace(/Auto-generated Return from [a-zA-Z0-9-_.]+/gi, '')
    .replace(/Auto-generated [a-zA-Z0-9-_.]+/gi, '')
    .trim();
  cleaned = cleaned.replace(/^[\s|.,;:-]+|[\s|.,;:-]+$/g, '').trim();
  return cleaned;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');
    const rawBrandId = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn');

    if (!dnQuery && !dateQuery) {
      return new NextResponse('Missing required parameters: dn or date', { status: 400 });
    }

    const cleanBrandId = (rawBrandId && rawBrandId !== 'undefined' && rawBrandId !== 'null') 
      ? rawBrandId 
      : null;

    // 1. Try to find transactions by deliveryNote first
    let txs = [];
    if (dnQuery && dnQuery !== 'UNASSIGNED') {
      txs = await prisma.inventoryTransaction.findMany({
        where: {
          deliveryNote: dnQuery,
          ...(cleanBrandId ? { product: { brandId: cleanBrandId } } : {})
        },
        include: {
          product: { include: { brand: true } },
          serialNumbers: { include: { serialNumber: true } },
          deliverySupervisor: true
        },
        orderBy: { timestamp: 'asc' }
      });
    }

    // 2. If not found by DN alone or UNASSIGNED, try date-range match
    if (txs.length === 0 && dateQuery) {
      const cleanDate = dateQuery.split('T')[0];
      const dayStart = new Date(`${cleanDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${cleanDate}T23:59:59.999Z`);

      txs = await prisma.inventoryTransaction.findMany({
        where: {
          deliveryNote: dnQuery === 'UNASSIGNED' ? null : (dnQuery || undefined),
          timestamp: { gte: dayStart, lte: dayEnd },
          ...(cleanBrandId ? { product: { brandId: cleanBrandId } } : {})
        },
        include: {
          product: { include: { brand: true } },
          serialNumbers: { include: { serialNumber: true } },
          deliverySupervisor: true
        },
        orderBy: { timestamp: 'asc' }
      });
    }

    // 3. Fallback: search without brand restriction if still empty
    if (txs.length === 0 && dnQuery && dnQuery !== 'UNASSIGNED') {
      txs = await prisma.inventoryTransaction.findMany({
        where: { deliveryNote: dnQuery },
        include: {
          product: { include: { brand: true } },
          serialNumbers: { include: { serialNumber: true } },
          deliverySupervisor: true
        },
        orderBy: { timestamp: 'asc' }
      });
    }

    if (txs.length === 0) {
      return new NextResponse('No client return transactions found for specified filters.', { status: 404 });
    }

    // Metadata & brand extraction
    const firstTx = txs[0];
    const brandName = firstTx.product?.brand?.name || 'General';
    const rawDateStr = firstTx.timestamp 
      ? new Date(firstTx.timestamp).toISOString().split('T')[0] 
      : (dateQuery ? dateQuery.split('T')[0] : new Date().toISOString().split('T')[0]);
    const dateFormatted = formatDate(rawDateStr);
    const docNo = (dnQuery && dnQuery !== 'UNASSIGNED') ? dnQuery : (firstTx.deliveryNote || 'UNASSIGNED');

    const receiverName = firstTx.receivedBy || firstTx.toEntityId || '';
    const supervisorName = firstTx.deliverySupervisor?.name || '';
    const notes = cleanNotes(firstTx.notes || '');

    // Group items by product
    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const parsedItemNotes = cleanNotes(tx.notes || '');
      
      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          productId: prod.id,
          name: prod.name,
          itemCode: prod.itemCode,
          category: prod.category,
          isSerialized: prod.isSerialized,
          quantity: 0,
          serials: [],
          notes: parsedItemNotes,
          subtext: ''
        };
      }

      productGroups[prod.id].quantity += Math.abs(tx.quantity);

      if (prod.isSerialized && tx.serialNumbers && tx.serialNumbers.length > 0) {
        for (const sNum of tx.serialNumbers) {
          if (sNum?.serialNumber?.barcode) {
            productGroups[prod.id].serials.push({
              barcode: sNum.serialNumber.barcode
            });
          }
        }
      }
    }

    const inventory = Object.values(productGroups);

    // Render react-pdf document to a stream
    const pdfStream = await renderToStream(
      <DeliveryNoteDocument
        title="CLIENT RETURN NOTE (GATE PASS)"
        brandName={brandName}
        inventory={inventory}
        dateStr={dateFormatted}
        docNo={docNo}
        receiverName={receiverName}
        supervisorName={supervisorName}
        notes={notes}
        metaFields={{
          left: [
            { label: 'Warehouse', value: 'IML Warehouse Al Quoz' },
            { label: 'Brand', value: brandName },
            { label: 'Destination', value: 'Client Dispatched' },
            ...(supervisorName ? [{ label: 'Supervisor', value: supervisorName }] : []),
          ],
          right: [
            { label: 'Date', value: dateFormatted },
            { label: 'Gate Pass No', value: docNo },
            ...(receiverName ? [{ label: 'Client Rep', value: receiverName }] : []),
            ...(notes ? [{ label: 'Remarks', value: notes }] : []),
          ]
        }}
        signatureLabels={[
          { label: 'PREPARED BY (WH)' },
          { label: `APPROVED BY (${supervisorName || 'SUPERVISOR'})` },
          { label: `RECEIVED BY (${receiverName || 'CLIENT REPV'})` },
        ]}
      />
    );

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-ClientReturn-GatePass-${docNo}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Client Return Gate Pass PDF Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
