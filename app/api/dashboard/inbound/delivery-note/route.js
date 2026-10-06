import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { DeliveryNoteDocument, formatDate } from '@/lib/pdf/deliveryNote';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


function cleanNotes(noteStr) {
  if (!noteStr) return '';
  let cleaned = noteStr
    .replace(/Auto-generated Return from Outbound [a-zA-Z0-9-_.]+/gi, '')
    .replace(/Auto-generated Return from [a-zA-Z0-9-_.]+/gi, '')
    .replace(/Auto-generated [a-zA-Z0-9-_.]+/gi, '')
    .replace(/Reverted rebrand [^\n|]+/gi, '')
    .replace(/Restored \d+ units [^\n|]+/gi, '')
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
    const brandIdQuery = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn');

    if (!dateQuery || !brandIdQuery || !dnQuery) {
      return new NextResponse('Missing required parameters: date, brandId, dn', { status: 400 });
    }

    const brandObj = await prisma.brand.findUnique({ where: { id: brandIdQuery } });
    const brandName = brandObj?.name || 'Sadia';

    const dayStart = new Date(`${dateQuery}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateQuery}T23:59:59.999Z`);

    const txs = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['RECEIVE', 'RETURN'] },
        deliveryNote: dnQuery,
        timestamp: { gte: dayStart, lte: dayEnd },
        product: { brandId: brandIdQuery }
      },
      include: {
        product: { include: { brand: true } },
        serialNumbers: { include: { serialNumber: true } },
        deliverySupervisor: true
      },
      orderBy: { timestamp: 'asc' }
    });

    if (txs.length === 0) {
      return new NextResponse('No matching inbound receipts found for specified filter.', { status: 404 });
    }

    // Determine document type
    const isReturn = txs.some(t => t.transactionType === 'RETURN') || (dnQuery && (dnQuery.startsWith('RET-') || dnQuery.includes('-RET-')));
    const isSupplierReceive = txs.some(t => t.transactionType === 'RECEIVE' || t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR') || (dnQuery && (dnQuery.startsWith('REC-') || dnQuery.startsWith('IN-')));

    let docTitle = 'DELIVERY NOTE';
    if (isReturn) {
      docTitle = 'RETURN NOTE';
    } else if (isSupplierReceive) {
      docTitle = 'RECEIVE NOTE';
    }

    // Resolve Store Name if from Store
    const fromEntityType = txs[0]?.fromEntityType;
    const fromEntityId = txs[0]?.fromEntityId;
    const toEntityType = txs[0]?.toEntityType;
    const toEntityId = txs[0]?.toEntityId;

    const storeId = (fromEntityType === 'STORE' ? fromEntityId : null) || 
                    (toEntityType === 'STORE' ? toEntityId : null) || 
                    (fromEntityId?.startsWith('STR-') ? fromEntityId : null) ||
                    (toEntityId?.startsWith('STR-') ? toEntityId : null);

    let storeName = '';
    let supplierName = '';

    if (storeId) {
      const storeObj = await prisma.store.findUnique({ where: { id: storeId } });
      if (storeObj) {
        storeName = storeObj.region ? `${storeObj.name} (${storeObj.region})` : storeObj.name;
      } else {
        storeName = storeId;
      }
    } else if (fromEntityType === 'SUPPLIER' || fromEntityType === 'VENDOR' || isSupplierReceive) {
      supplierName = fromEntityId || 'Supplier';
    } else if (fromEntityId) {
      supplierName = fromEntityId;
    }

    // Resolve Delivery Supervisor
    let supervisorName = txs.find(t => t.deliverySupervisor?.name)?.deliverySupervisor?.name || '';
    let origTx = null;
    const origMatch = txs[0]?.notes?.match(/from Outbound ([a-zA-Z0-9-_.]+)/);
    if (origMatch && origMatch[1]) {
      const cleanOrigId = origMatch[1].replace(/[.,;]+$/, '');
      origTx = await prisma.inventoryTransaction.findFirst({
        where: { OR: [{ id: cleanOrigId }, { deliveryNote: cleanOrigId }] },
        include: { deliverySupervisor: true }
      });
      if (!supervisorName && origTx?.deliverySupervisor?.name) {
        supervisorName = origTx.deliverySupervisor.name;
      }
    }

    if (!supervisorName && txs[0]?.deliverySupervisorId) {
      const supObj = await prisma.supervisor.findUnique({ where: { id: txs[0].deliverySupervisorId } });
      if (supObj?.name) supervisorName = supObj.name;
    }

    // Look up Staff & Uniform Allocations for Promoter Details (Only for store-related transactions)
    let uniformAllocations = [];
    let primaryStaff = null;

    if (!isSupplierReceive && (storeId || dnQuery)) {
      const allocationConditions = [];
      if (dnQuery && dnQuery !== 'UNASSIGNED') allocationConditions.push({ ref: dnQuery });
      if (origTx?.deliveryNote) allocationConditions.push({ ref: origTx.deliveryNote });
      if (storeId) allocationConditions.push({ storeId: storeId });

      if (allocationConditions.length > 0) {
        uniformAllocations = await prisma.staffUniformAllocation.findMany({
          where: { OR: allocationConditions },
          include: {
            staff: { include: { store: true } },
            store: true,
            supervisor: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        primaryStaff = uniformAllocations[0]?.staff || null;
      }

      if (!primaryStaff && storeId) {
        primaryStaff = await prisma.staff.findFirst({
          where: { storeId: storeId },
          include: { store: true }
        });
      }
    }

    if (!supervisorName && uniformAllocations[0]?.supervisor?.name) {
      supervisorName = uniformAllocations[0].supervisor.name;
    }

    // Resolve Received By from Database (do not use session.user.name)
    const receiverName = supervisorName || txs.find(t => t.receivedBy && t.receivedBy.trim())?.receivedBy?.trim() || '';

    // Clean Document-level notes
    const rawNotes = txs[0]?.notes?.includes(' | ') ? txs[0].notes.split(' | ')[0] : (txs[0]?.notes || '');
    const notes = cleanNotes(rawNotes);

    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const rawItemNotes = tx.notes?.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
      const parsedItemNotes = cleanNotes(rawItemNotes);
      const isUniform = prod.category?.toUpperCase() === 'UNIFORM' || 
                        prod.name?.toLowerCase().includes('shirt') || 
                        prod.name?.toLowerCase().includes('uniform') || 
                        prod.name?.toLowerCase().includes('cap') ||
                        prod.name?.toLowerCase().includes('frock') ||
                        prod.name?.toLowerCase().includes('abaya') ||
                        prod.name?.toLowerCase().includes('apron');

      // STRICT RULE: Only uniform items with an assigned promoter get promoter subtext
      let itemSubtext = '';
      if (isUniform && !isSupplierReceive && primaryStaff?.name) {
        const itemSize = prod.size || primaryStaff.shirtSize || '';
        itemSubtext = [
          `Promoter: ${primaryStaff.name}${primaryStaff.phone ? ` (${primaryStaff.phone})` : ''}`,
          itemSize ? `Size: ${itemSize}` : null,
          storeName ? `Store: ${storeName}` : (primaryStaff.store?.name ? `Store: ${primaryStaff.store.name}` : null),
          uniformAllocations[0]?.workingPeriod ? `Period: ${uniformAllocations[0].workingPeriod}` : null,
        ].filter(Boolean).join(' | ');
      }

      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          name: prod.name,
          imageUrl: prod.imageUrl,
          subtext: itemSubtext,
          isSerialized: prod.isSerialized,
          quantity: 0,
          serials: [],
          notes: parsedItemNotes
        };
      }
      productGroups[prod.id].quantity += tx.quantity;
      if (prod.isSerialized && tx.serialNumbers) {
        for (const sNum of tx.serialNumbers) {
          if (sNum.serialNumber?.barcode) {
            productGroups[prod.id].serials.push({ barcode: sNum.serialNumber.barcode });
          }
        }
      }
    }

    const inventory = Object.values(productGroups);
    const dateStr = formatDate(dateQuery);

    const leftMeta = [
      { label: 'Warehouse', value: 'IML Warehouse Al Quoz' },
      { label: 'Brand', value: brandName },
      ...(isReturn && storeName ? [{ label: 'Store', value: storeName }] : []),
      ...(!isReturn && storeName ? [{ label: 'Store Name', value: storeName }] : []),
      ...(supplierName ? [{ label: 'Supplier / Vendor', value: supplierName }] : []),
      ...(supervisorName ? [{ label: 'Supervisor', value: supervisorName }] : []),
      ...(notes ? [{ label: 'Notes', value: notes }] : []),
    ];

    const rightMeta = [
      { label: 'Document No', value: dnQuery },
      { label: 'Date', value: dateStr },
    ];

    const signatureLabels = isReturn ? [
      { label: 'RETURNED BY' },
      { label: 'CHECKED BY' },
      { label: 'RECEIVED BY (WH)' },
    ] : (isSupplierReceive ? [
      { label: 'DELIVERED BY (SUPPLIER)' },
      { label: 'CHECKED BY' },
      { label: 'RECEIVED BY (WH)' },
    ] : [
      { label: 'PREPARED BY' },
      { label: 'CHECKED BY' },
      { label: 'RECEIVED BY' },
    ]);

    const showImages = searchParams.get('images') === '1' || searchParams.get('images') === 'true' || searchParams.get('showImages') === 'true';

    const pdfStream = await renderToStream(
      <DeliveryNoteDocument
        title={docTitle}
        supplierName={supplierName}
        brandName={brandName}
        inventory={inventory}
        dateStr={dateStr}
        docNo={dnQuery}
        receiverName={receiverName}
        supervisorName={supervisorName}
        notes={notes}
        metaFields={{
          left: leftMeta,
          right: rightMeta
        }}
        showImages={showImages}
        signatureLabels={signatureLabels}
      />
    );

    const docPrefix = isReturn ? 'ReturnNote' : (isSupplierReceive ? 'ReceiveNote' : 'DeliveryNote');

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-${docPrefix}-${dateStr}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
