import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStoreInventory } from '@/app/actions/transactions';
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
    const { id } = { id: request.url.split('/stores/')[1]?.split('/')[0] };

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      return new NextResponse('Store not found.', { status: 404 });
    }

    let inventory = [];
    let docNo = '';
    let dateStr = '';
    let brandName = 'Sadia';
    let supervisorName = '';
    let receiverName = '';
    let contactDetails = '';
    let notes = '';

    const brandObj = brandIdQuery ? await prisma.brand.findUnique({ where: { id: brandIdQuery } }) : null;
    if (brandObj) brandName = brandObj.name;

    if (dateQuery && brandIdQuery && dnQuery) {
      // Specific date + brand + DN query
      const cleanDate = dateQuery.split('T')[0];
      const dayStart = new Date(`${cleanDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${cleanDate}T23:59:59.999Z`);

      const [txs, uniformAllocations] = await Promise.all([
        prisma.inventoryTransaction.findMany({
          where: {
            transactionType: 'ISSUE',
            deliveryNote: dnQuery === 'UNASSIGNED' ? null : dnQuery,
            timestamp: { gte: dayStart, lte: dayEnd },
            product: { brandId: brandIdQuery },
            OR: [
              { toEntityId: id },
              { fromEntityId: id },
            ]
          },
          select: {
            id: true,
            notes: true,
            quantity: true,
            receivedBy: true,
            fromEntityType: true,
            fromEntityId: true,
            deliverySupervisorId: true,
            deliverySupervisor: {
              select: { id: true, name: true, phone: true }
            },
            product: { select: { id: true, name: true, itemCode: true, category: true, isSerialized: true } },
            serialNumbers: { select: { serialNumber: { select: { barcode: true } } } }
          }
        }),
        prisma.staffUniformAllocation.findMany({
          where: {
            OR: [
              { ref: dnQuery },
              { storeId: id }
            ]
          },
          include: {
            staff: { select: { id: true, name: true, phone: true, shirtSize: true } },
            supervisor: { select: { id: true, name: true, phone: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      ]);

      if (txs.length === 0) {
        return new NextResponse('No matching outbound dispatches found for specified filter.', { status: 404 });
      }

      notes = txs[0]?.notes?.includes(' | ') ? txs[0].notes.split(' | ')[0] : (txs[0]?.notes || '');

      // Check if from supplier
      const isSupplier = txs.some(t => t.fromEntityType === 'SUPPLIER' || t.fromEntityType === 'VENDOR');
      const supplierName = isSupplier ? (txs[0]?.fromEntityId || 'Supplier') : '';

      // Resolve supervisor name
      const txSupervisor = txs.find(t => t.deliverySupervisor?.name)?.deliverySupervisor;
      if (txSupervisor) {
        supervisorName = txSupervisor.name;
      } else if (uniformAllocations.length > 0 && uniformAllocations[0].supervisor?.name) {
        supervisorName = uniformAllocations[0].supervisor.name;
      }

      // Resolve receiver name & staff details
      const allocStaff = uniformAllocations.length > 0 ? uniformAllocations[0].staff : null;
      const txReceiver = txs.find(t => t.receivedBy)?.receivedBy;

      if (isSupplier) {
        receiverName = txReceiver || `${store.name} Staff`;
      } else if (allocStaff?.name) {
        receiverName = `${allocStaff.name} (Promoter)`;
        contactDetails = allocStaff.phone || '';
      } else if (txReceiver) {
        receiverName = txReceiver;
      } else {
        const storeStaff = await prisma.staff.findFirst({
          where: { storeId: id },
          select: { name: true, phone: true }
        });
        if (storeStaff) {
          receiverName = storeStaff.name;
          contactDetails = storeStaff.phone || '';
        } else {
          receiverName = `${store.name} In-charge`;
        }
      }

      const productGroups = {};
      for (const tx of txs) {
        const prod = tx.product;
        const parsedItemNotes = tx.notes?.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
        const isUniform = prod.category?.toUpperCase() === 'UNIFORM' || 
                          prod.name?.toLowerCase().includes('shirt') || 
                          prod.name?.toLowerCase().includes('uniform') || 
                          prod.name?.toLowerCase().includes('cap') ||
                          prod.name?.toLowerCase().includes('frock') ||
                          prod.name?.toLowerCase().includes('abaya') ||
                          prod.name?.toLowerCase().includes('apron');
        
        let itemSubtext = '';
        if (isUniform && allocStaff?.name) {
          itemSubtext = [
            `Promoter: ${allocStaff.name}${allocStaff.phone ? ` (${allocStaff.phone})` : ''}`,
            allocStaff.shirtSize ? `Size: ${allocStaff.shirtSize}` : null,
            `Store: ${store.name}`,
            uniformAllocations[0]?.workingPeriod ? `Period: ${uniformAllocations[0].workingPeriod}` : null,
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
          for (const sNum of tx.serialNumbers) {
            if (sNum.serialNumber?.barcode) {
              productGroups[prod.id].serials.push({ barcode: sNum.serialNumber.barcode });
            }
          }
        }
      }

      inventory = Object.values(productGroups);
      docNo = dnQuery === 'UNASSIGNED' ? `IML-DISP-${cleanDate.replace(/-/g, '')}` : dnQuery;
      dateStr = formatDate(cleanDate);
    } else {
      // Fallback: full placement summary
      inventory = await getStoreInventory(id);
      if (inventory.length === 0) {
        return new NextResponse('No items present in store to generate a delivery note.', { status: 400 });
      }
      if (inventory[0]?.brandName) brandName = inventory[0].brandName;

      const dateObj = new Date();
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      dateStr = `${dd}-${mm}-${yyyy}`;
      const timeHash = dateObj.getTime().toString().slice(-4);
      docNo = `IML-${brandName || 'SADIA'}-DN-${dateStr}-${timeHash}`;
    }

    const effectiveReceiver = supervisorName || '';

    const pdfStream = await renderToStream(
      <DeliveryNoteDocument
        title="DELIVERY NOTE"
        brandName={brandName}
        inventory={inventory}
        dateStr={dateStr}
        docNo={docNo}
        supervisorName={supervisorName}
        receiverName={effectiveReceiver}
        notes={notes}
        metaFields={{
          left: [
            { label: 'Warehouse', value: 'IML Warehouse Al qouz' },
            { label: 'Brand', value: brandName },
            { label: 'Store Name', value: store.name },
            ...(effectiveReceiver ? [{ label: 'Receiver Name', value: effectiveReceiver }] : []),
            ...(notes ? [{ label: 'Notes', value: notes }] : []),
          ],
          right: [
            { label: 'Date', value: dateStr },
            { label: 'Document No', value: docNo },
          ],
        }}
      />
    );

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-DeliveryNote-${store.name.replace(/\s+/g, '_')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
