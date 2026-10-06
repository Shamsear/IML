import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
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

    if (txs.length === 0) {
      return new NextResponse('No matching delivery note or return transactions found.', { status: 404 });
    }

    // Resolve Brand Name safely
    let brandName = 'Sadia';
    if (cleanBrandId) {
      const brandObj = await prisma.brand.findUnique({ where: { id: cleanBrandId } });
      if (brandObj?.name) brandName = brandObj.name;
    }
    if (brandName === 'Sadia' && txs[0]?.product?.brand?.name) {
      brandName = txs[0].product.brand.name;
    }

    // Determine transaction nature
    const isReturn = txs.some(t => t.transactionType === 'RETURN') || (dnQuery && (dnQuery.startsWith('RET-') || dnQuery.includes('-RET-')));
    const isSupplierReceive = txs.some(t => t.transactionType === 'RECEIVE' || t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR') || (dnQuery && (dnQuery.startsWith('REC-') || dnQuery.startsWith('IN-')));
    
    let docTitle = 'DELIVERY NOTE';
    if (isReturn) {
      docTitle = 'RETURN NOTE';
    } else if (isSupplierReceive) {
      docTitle = 'RECEIVE NOTE';
    }

    // Resolve Store Name
    const storeId = (txs[0].toEntityType === 'STORE' ? txs[0].toEntityId : null) || 
                    (txs[0].fromEntityType === 'STORE' ? txs[0].fromEntityId : null) ||
                    (txs[0].fromEntityId?.startsWith('STR-') ? txs[0].fromEntityId : null) ||
                    (txs[0].toEntityId?.startsWith('STR-') ? txs[0].toEntityId : null);

    let storeName = '';
    if (storeId) {
      const storeObj = await prisma.store.findUnique({ where: { id: storeId } });
      if (storeObj?.name) {
        storeName = storeObj.region ? `${storeObj.name} (${storeObj.region})` : storeObj.name;
      } else {
        storeName = storeId;
      }
    }

    // Resolve Supervisor Name
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

    // Find Supplier Name (if supplier transaction)
    const supplierTx = txs.find(t => t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR');
    const supplierName = supplierTx?.fromEntityId || (isSupplierReceive ? (txs[0]?.fromEntityId || 'Supplier') : '');

    // Check Staff / Uniform Allocation for Promoter Details (Only for store transactions)
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
      const isUniform = (prod.category?.toUpperCase() === 'UNIFORM') || 
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
      { label: 'Warehouse', value: 'IML Warehouse Al Quoz' },
      { label: 'Brand', value: brandName },
      ...(isSupplierReceive && supplierName ? [{ label: 'Supplier / Vendor', value: supplierName }] : []),
      ...(storeName ? [{ label: isReturn ? 'Store' : 'Store Name', value: storeName }] : []),
      ...(supervisorName ? [{ label: 'Supervisor', value: supervisorName }] : []),
      ...(notes ? [{ label: 'Notes', value: notes }] : []),
    ];

    const rightMeta = [
      { label: 'Document No', value: docNo },
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

    const pdfBuffer = await renderToBuffer(
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
        showImages={showImages}
        signatureLabels={signatureLabels}
      />
    );

    const safeBrand = (brandName || 'DeliveryNote').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDocNo = (docNo || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-${safeBrand}-${safeDocNo}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (error) {
    console.error('[Delivery/Return Note PDF Generation Error]:', error);
    return new NextResponse(`Error generating PDF: ${error.message || 'Internal Server Error'}`, { status: 500 });
  }
}
