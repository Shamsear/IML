import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStoreInventory } from '@/app/actions/transactions';
import React from 'react';
import { 
  Document, Page, Text, View, StyleSheet, renderToStream, Svg, Polygon, Circle
} from '@react-pdf/renderer';

const pdfStyles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
  },
  outerContainer: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    minHeight: '97%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    textDecoration: 'underline',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000000',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyLeft: {
    width: '60%',
  },
  companyNameBlue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginBottom: 3,
  },
  companyText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  companyTelBlue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginTop: 2,
  },
  logoRight: {
    width: '40%',
    alignItems: 'flex-end',
  },
  logoTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991b1b',
    marginTop: 4,
  },
  logoTagline: {
    fontSize: 8,
    fontStyle: 'italic',
    color: '#4b5563',
  },

  // Metadata Box (Bordered 2 columns)
  metaBox: {
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    marginBottom: 10,
  },
  metaLeft: {
    width: '50%',
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  metaRight: {
    width: '50%',
    padding: 5,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    width: 95,
  },
  metaVal: {
    fontSize: 9,
    fontWeight: 'bold',
    flex: 1,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingVertical: 3,
    backgroundColor: '#ffffff',
  },
  thSl: { width: '8%', textAlign: 'center', fontWeight: 'bold', fontSize: 9, borderRightWidth: 1, borderRightColor: '#000000' },
  thDesc: { width: '56%', paddingLeft: 5, fontWeight: 'bold', fontSize: 9, borderRightWidth: 1, borderRightColor: '#000000' },
  thQty: { width: '12%', textAlign: 'center', fontWeight: 'bold', fontSize: 9, borderRightWidth: 1, borderRightColor: '#000000' },
  thRemarks: { width: '24%', paddingLeft: 5, fontWeight: 'bold', fontSize: 9 },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    height: 16,
    alignItems: 'center',
  },
  tdSl: { width: '8%', textAlign: 'center', fontSize: 8, fontWeight: 'bold', borderRightWidth: 1, borderRightColor: '#000000' },
  tdDesc: { width: '56%', paddingLeft: 5, fontSize: 8, fontWeight: 'bold', borderRightWidth: 1, borderRightColor: '#000000' },
  tdQty: { width: '12%', textAlign: 'center', fontSize: 8, fontWeight: 'bold', borderRightWidth: 1, borderRightColor: '#000000' },
  tdRemarks: { width: '24%', paddingLeft: 5, fontSize: 8 },

  // Footer Box
  footerBox: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    marginTop: 4,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingHorizontal: 10,
  },
  signatureCol: {
    width: '30%',
    alignItems: 'center',
  },
  dashedText: {
    fontSize: 9,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 'bold',
  },
});

const DeliveryNoteDocument = ({ store, brandName, inventory, dateStr, docNo, receiverName, contactDetails, notes }) => {
  const totalTableRows = 28;
  const rows = Array.from({ length: totalTableRows }, (_, idx) => inventory[idx] || null);

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.outerContainer}>
          <View style={pdfStyles.topSection}>
            {/* Title */}
            <Text style={pdfStyles.docTitle}>DELIVERY NOTE</Text>

            {/* Header Info Row */}
            <View style={pdfStyles.headerRow}>
              <View style={pdfStyles.companyLeft}>
                <Text style={pdfStyles.companyNameBlue}>THE IML GROUP</Text>
                <Text style={pdfStyles.companyText}>P.O.Box:</Text>
                <Text style={pdfStyles.companyText}>Address: Al Quoz - Dubai</Text>
                <Text style={pdfStyles.companyText}>www.imlme.com/</Text>
                <Text style={pdfStyles.companyTelBlue}>Tel : 04 330 6455</Text>
              </View>

              <View style={pdfStyles.logoRight}>
                {/* SVG Logo mark matching the red & blue diamond logo */}
                <Svg height="36" width="36" viewBox="0 0 100 100">
                  <Polygon points="50,5 95,50 50,50" fill="#b91c1c" />
                  <Polygon points="50,5 5,50 50,50" fill="#1d4ed8" />
                  <Polygon points="50,50 95,50 50,95" fill="#1d4ed8" />
                  <Polygon points="50,50 5,50 50,95" fill="#b91c1c" />
                  <Circle cx="50" cy="50" r="8" fill="#ffffff" />
                  <Circle cx="50" cy="50" r="4" fill="#b91c1c" />
                </Svg>
                <Text style={pdfStyles.logoTitle}>THE IML GROUP</Text>
                <Text style={pdfStyles.logoTagline}>Making the Difference</Text>
              </View>
            </View>

            {/* Metadata Box */}
            <View style={pdfStyles.metaBox}>
              <View style={pdfStyles.metaLeft}>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Warehouse :-</Text>
                  <Text style={pdfStyles.metaVal}>IML Warehouse Al qouz</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Brand :-</Text>
                  <Text style={pdfStyles.metaVal}>{brandName || 'Sadia'}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Store Name :-</Text>
                  <Text style={pdfStyles.metaVal}>{store.name}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Notes :-</Text>
                  <Text style={pdfStyles.metaVal}>{notes || ''}</Text>
                </View>
              </View>

              <View style={pdfStyles.metaRight}>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Date :-</Text>
                  <Text style={pdfStyles.metaVal}>{dateStr}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Document No :-</Text>
                  <Text style={pdfStyles.metaVal}>{docNo}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Receiver Name :-</Text>
                  <Text style={pdfStyles.metaVal}>{receiverName || ''}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Contact Details :-</Text>
                  <Text style={pdfStyles.metaVal}>{contactDetails || ''}</Text>
                </View>
              </View>
            </View>

            {/* 28-Row Items Table */}
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={pdfStyles.thSl}>SL NO.</Text>
                <Text style={pdfStyles.thDesc}>DESCRIPTION</Text>
                <Text style={pdfStyles.thQty}>Qty</Text>
                <Text style={pdfStyles.thRemarks}>Remarks</Text>
              </View>

              {rows.map((item, idx) => (
                <View style={pdfStyles.tableRow} key={idx}>
                  <Text style={pdfStyles.tdSl}>{idx + 1}</Text>
                  <View style={pdfStyles.tdDesc}>
                    {item ? (
                      <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    ) : (
                      <Text></Text>
                    )}
                  </View>
                  <Text style={pdfStyles.tdQty}>{item ? item.quantity : ''}</Text>
                  <Text style={pdfStyles.tdRemarks}>
                    {item ? (
                      item.isSerialized && item.serials && item.serials.length > 0 
                        ? `Serials: ${item.serials.map(s => s.barcode).join(', ')}` 
                        : (item.notes || '')
                    ) : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Signature Footer */}
          <View style={pdfStyles.footerBox}>
            <View style={pdfStyles.signatureRow}>
              <View style={pdfStyles.signatureCol}>
                <Text style={pdfStyles.dashedText}>------------------------</Text>
                <Text style={pdfStyles.signatureLabel}>PREPARED BY</Text>
              </View>
              <View style={pdfStyles.signatureCol}>
                <Text style={pdfStyles.dashedText}>------------------------</Text>
                <Text style={pdfStyles.signatureLabel}>CHECKED BY</Text>
              </View>
              <View style={pdfStyles.signatureCol}>
                <Text style={pdfStyles.dashedText}>------------------------</Text>
                <Text style={pdfStyles.signatureLabel}>RECEIVED BY</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export async function GET(request, { params }) {
  // 1. Authenticate user
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  try {
    // 2. Fetch Store Details
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return new NextResponse('Store not found', { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date'); // YYYY-MM-DD
    const brandIdQuery = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn');

    let inventory = [];
    let docNo = '';
    let dateStr = '';
    let brandName = '';
    let receiverName = '';
    let contactDetails = '';
    let notes = '';

    if (dateQuery && brandIdQuery && dnQuery) {
      // Fetch Brand Info
      const brandObj = await prisma.brand.findUnique({ where: { id: brandIdQuery } });
      if (brandObj) {
        brandName = brandObj.name;
      }

      // Fetch Staff placed at store for receiver name & phone
      const staffMember = await prisma.staff.findFirst({
        where: { storeId: id },
      });
      if (staffMember) {
        receiverName = staffMember.name;
        contactDetails = staffMember.phone || '';
      }

      // Query specific issue transactions
      const dayStart = new Date(`${dateQuery}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateQuery}T23:59:59.999Z`);

      const txs = await prisma.inventoryTransaction.findMany({
        where: {
          toEntityType: 'STORE',
          toEntityId: id,
          transactionType: 'ISSUE',
          deliveryNote: dnQuery === 'UNASSIGNED' ? null : dnQuery,
          timestamp: {
            gte: dayStart,
            lte: dayEnd,
          },
          product: {
            brandId: brandIdQuery,
          }
        },
        include: {
          product: true,
          serialNumbers: {
            include: {
              serialNumber: true
            }
          }
        }
      });

      if (txs.length === 0) {
        return new NextResponse('No matching dispatches found for specified filter.', { status: 404 });
      }

      if (txs[0]?.notes) {
        notes = txs[0].notes;
      }

      // Group transactions by product ID to build consolidated list
      const productGroups = {};
      for (const tx of txs) {
        const prod = tx.product;
        if (!productGroups[prod.id]) {
          productGroups[prod.id] = {
            productId: prod.id,
            name: prod.name,
            itemCode: prod.itemCode,
            category: prod.category,
            isSerialized: prod.isSerialized,
            quantity: 0,
            serials: [],
            notes: tx.notes || ''
          };
        }
        productGroups[prod.id].quantity += tx.quantity;
        if (prod.isSerialized && tx.serialNumbers) {
          for (const sNum of tx.serialNumbers) {
            productGroups[prod.id].serials.push({
              barcode: sNum.serialNumber.barcode
            });
          }
        }
      }

      inventory = Object.values(productGroups);
      docNo = dnQuery === 'UNASSIGNED' ? `IML-DISP-${dateQuery.replace(/-/g, '')}` : dnQuery;

      const parts = dateQuery.split('-');
      dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      // Fallback: full placement summary
      inventory = await getStoreInventory(id);
      if (inventory.length === 0) {
        return new NextResponse('No items present in store to generate a delivery note.', { status: 400 });
      }
      if (inventory[0]?.brandName) {
        brandName = inventory[0].brandName;
      }
      const staffMember = await prisma.staff.findFirst({
        where: { storeId: id },
      });
      if (staffMember) {
        receiverName = staffMember.name;
        contactDetails = staffMember.phone || '';
      }

      const dateObj = new Date();
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      dateStr = `${dd}-${mm}-${yyyy}`;
      const timeHash = dateObj.getTime().toString().slice(-4);
      docNo = `IML-${brandName || 'SADIA'}-DEL-${dateStr}-${timeHash}`;
    }

    // 5. Render react-pdf document to a stream
    const pdfStream = await renderToStream(
      <DeliveryNoteDocument 
        store={store} 
        brandName={brandName}
        inventory={inventory} 
        dateStr={dateStr} 
        docNo={docNo}
        receiverName={receiverName}
        contactDetails={contactDetails}
        notes={notes}
      />
    );

    // 6. Return PDF stream as download response
    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="IML-DeliveryNote-${store.name.replace(/\s+/g, '_')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
