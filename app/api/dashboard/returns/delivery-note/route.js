import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { DeliveryNoteDocument, formatDate } from '@/lib/pdf/deliveryNote';

const isValidUuid = (str) => typeof str === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

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
    const rawBrandId = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn');

    if (!dnQuery && !dateQuery) {
      return new NextResponse('Missing required parameters: dn or date', { status: 400 });
    }

    const cleanBrandId = (rawBrandId && rawBrandId !== 'undefined' && rawBrandId !== 'null' && isValidUuid(rawBrandId)) 
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

    if (txs.length === 0) {
      return new NextResponse('No matching delivery note or return transactions found.', { status: 404 });
    }

    // Resolve Brand Name safely
    let brandName = 'N/A';
    if (cleanBrandId) {
      const brandObj = await prisma.brand.findUnique({ where: { id: cleanBrandId } });
      if (brandObj?.name) brandName = brandObj.name;
    }
    if (brandName === 'N/A' && txs[0]?.product?.brand?.name) {
      brandName = txs[0].product.brand.name;
    }

    // Determine transaction nature
    const isReturn = txs.some(t => t.transactionType === 'RETURN') || (dnQuery && dnQuery.includes('-RET-'));
    const isSupplierReceive = txs.some(t => t.transactionType === 'RECEIVE' || t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR') || (dnQuery && (dnQuery.startsWith('REC-') || dnQuery.startsWith('IN-')));
    
    let docTitle = 'DELIVERY NOTE';
    if (isReturn) {
      docTitle = 'RETURN NOTE';
    } else if (isSupplierReceive) {
      docTitle = 'RECEIVE NOTE';
    }

    // Resolve Store Name
    const storeId = txs[0].toEntityType === 'STORE' ? txs[0].toEntityId : (txs[0].fromEntityType === 'STORE' ? txs[0].fromEntityId : null);
    let storeName = '';
    if (storeId && isValidUuid(storeId)) {
      const storeObj = await prisma.store.findUnique({ where: { id: storeId } });
      if (storeObj?.name) storeName = storeObj.name;
    }

    // Resolve Supervisor Name
    let supervisorName = txs.find(t => t.deliverySupervisor?.name)?.deliverySupervisor?.name || '';
    if (!supervisorName) {
      const origMatch = txs[0]?.notes?.match(/from Outbound ([a-zA-Z0-9-]+)/);
      if (origMatch && origMatch[1] && isValidUuid(origMatch[1])) {
        const origTx = await prisma.inventoryTransaction.findUnique({
          where: { id: origMatch[1] },
          include: { deliverySupervisor: true }
        });
        supervisorName = origTx?.deliverySupervisor?.name || '';
      }
    }

    // Find Supplier Name (if supplier transaction)
    const supplierTx = txs.find(t => t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR');
    const supplierName = supplierTx?.fromEntityId || (isSupplierReceive ? (txs[0]?.fromEntityId || 'Supplier') : '');

    // Check Staff / Uniform Allocation for Promoter Details
    let uniformAlloc = null;
    if (dnQuery && dnQuery !== 'UNASSIGNED') {
      uniformAlloc = await prisma.staffUniformAllocation.findFirst({
        where: { ref: dnQuery },
        include: {
          staff: { include: { store: true } },
          store: true,
          supervisor: true
        }
      });
    }
    if (!uniformAlloc && storeId) {
      uniformAlloc = await prisma.staffUniformAllocation.findFirst({
        where: { storeId },
        include: {
          staff: { include: { store: true } },
          store: true,
          supervisor: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    let promoterName = uniformAlloc?.staff?.name || '';
    let promoterPhone = uniformAlloc?.staff?.phone || '';
    let promoterSize = uniformAlloc?.staff?.shirtSize || '';
    let promoterStore = uniformAlloc?.store?.name || uniformAlloc?.staff?.store?.name || storeName || '';
    let workingPeriod = uniformAlloc?.workingPeriod || '';

    if (!supervisorName && uniformAlloc?.supervisor?.name) {
      supervisorName = uniformAlloc.supervisor.name;
    }

    // Receiver Name is Supervisor (if null, empty)
    const receiverName = supervisorName || '';

    const rawNotes = txs[0]?.notes?.split(' | ')[0] || '';
    const notes = cleanNotes(rawNotes);

    // Group items by product & put promoter details in subtext below item description
    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const rawItemNotes = tx.notes?.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
      const parsedItemNotes = cleanNotes(rawItemNotes);
      const isUniform = (prod.category?.toUpperCase() === 'UNIFORM') || prod.name?.toLowerCase().includes('shirt') || prod.name?.toLowerCase().includes('uniform') || prod.name?.toLowerCase().includes('cap');

      let itemSubtext = '';
      if ((isUniform || uniformAlloc) && promoterName) {
        itemSubtext = [
          `Promoter: ${promoterName}${promoterPhone ? ` (${promoterPhone})` : ''}`,
          promoterSize ? `Size: ${promoterSize}` : null,
          promoterStore ? `Store: ${promoterStore}` : null,
          workingPeriod ? `Period: ${workingPeriod}` : null,
        ].filter(Boolean).join(' | ');
      }

      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          name: prod.name,
          subtext: itemSubtext,
          isSerialized: prod.isSerialized,
          quantity: 0,
          serials: [],
          notes: parsedItemNotes
        };
      }
      productGroups[prod.id].quantity += tx.quantity;
      if (prod.isSerialized && tx.serialNumbers) {
        tx.serialNumbers.forEach(sn => {
          if (sn.serialNumber?.barcode) {
            productGroups[prod.id].serials.push({ barcode: sn.serialNumber.barcode });
          }
        });
      }
    }

    const inventory = Object.values(productGroups);
    const cleanDateStr = dateQuery ? dateQuery.split('T')[0] : new Date(txs[0].timestamp).toISOString().split('T')[0];
    const dateStr = formatDate(cleanDateStr);
    const docNo = (dnQuery && dnQuery !== 'UNASSIGNED') ? dnQuery : `IML-${isReturn ? 'RTN' : (isSupplierReceive ? 'REC' : 'DN')}-${cleanDateStr.replace(/-/g, '')}`;

    const leftMeta = [
      { label: 'Warehouse', value: 'IML Warehouse Al qouz' },
      { label: 'Brand', value: brandName },
      ...(isSupplierReceive && supplierName ? [{ label: 'Supplier / Vendor', value: supplierName }] : []),
      ...(storeName ? [{ label: isReturn ? 'Returned From Store' : 'Store Name', value: storeName }] : []),
      ...(receiverName ? [{ label: isReturn ? 'Returned By / Supervisor' : 'Receiver Name', value: receiverName }] : []),
      ...(notes ? [{ label: 'Notes', value: notes }] : []),
    ];

    const rightMeta = [
      { label: 'Date', value: dateStr },
      { label: 'Document No', value: docNo },
      ...(workingPeriod ? [{ label: 'Working Period', value: workingPeriod }] : []),
    ];

    const signatureLabels = isReturn ? [
      { label: 'PREPARED BY' },
      { label: 'CHECKED BY' },
      { label: 'AUTHORIZED BY' },
    ] : (isSupplierReceive ? [
      { label: 'RECEIVED BY (WH)' },
      { label: 'CHECKED BY' },
      { label: 'DELIVERED BY (SUPPLIER)' },
    ] : [
      { label: 'PREPARED BY' },
      { label: 'CHECKED BY' },
      { label: 'RECEIVED BY' },
    ]);

    const pdfStream = await renderToStream(
      <DeliveryNoteDocument
        title={docTitle}
        supplierName={supplierName}
        brandName={brandName}
        supervisorName={supervisorName}
        receiverName={receiverName}
        inventory={inventory}
        dateStr={dateStr}
        docNo={docNo}
        notes={notes}
        metaFields={{
          left: leftMeta,
          right: rightMeta
        }}
        signatureLabels={signatureLabels}
      />
    );

    const safeBrand = (brandName || 'DeliveryNote').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDocNo = (docNo || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_');

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-${safeBrand}-${safeDocNo}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Delivery/Return Note PDF Generation Error]:', error);
    return new NextResponse(`Error generating PDF: ${error.message || 'Internal Server Error'}`, { status: 500 });
  }
}
