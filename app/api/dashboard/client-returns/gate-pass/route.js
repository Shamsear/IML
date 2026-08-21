import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import React from 'react';
import { 
  Document, Page, Text, View, StyleSheet, renderToStream, Image
} from '@react-pdf/renderer';

// Read logo once at module load time as a base64 data URI
const logoPath = path.join(process.cwd(), 'public', 'IML LOGO V-C.png');
const logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

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
    fontSize: 14,
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

const ClientReturnDocument = ({ brandName, inventory, dateStr, docNo, receiverName, supervisorName, notes }) => {
  const totalTableRows = 28;
  const rows = Array.from({ length: totalTableRows }, (_, idx) => inventory[idx] || null);

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.outerContainer}>
          <View style={pdfStyles.topSection}>
            {/* Title */}
            <Text style={pdfStyles.docTitle}>CLIENT RETURN NOTE (GATE PASS)</Text>

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
                <Image
                  src={logoSrc}
                  style={{ width: 100, height: 60, objectFit: 'contain' }}
                />
              </View>
            </View>

            {/* Metadata Box */}
            <View style={pdfStyles.metaBox}>
              <View style={pdfStyles.metaLeft}>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Source :-</Text>
                  <Text style={pdfStyles.metaVal}>IML Warehouse Al qouz</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Brand/Client :-</Text>
                  <Text style={pdfStyles.metaVal}>{brandName || 'N/A'}</Text>
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
                  <Text style={pdfStyles.metaLabel}>Gate Pass No :-</Text>
                  <Text style={pdfStyles.metaVal}>{docNo}</Text>
                </View>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaLabel}>Client Recv. By :-</Text>
                  <Text style={pdfStyles.metaVal}>{receiverName || 'N/A'}</Text>
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
                <Text style={pdfStyles.signatureLabel}>APPROVED BY ({supervisorName || 'SUPERVISOR'})</Text>
              </View>
              <View style={pdfStyles.signatureCol}>
                <Text style={pdfStyles.dashedText}>------------------------</Text>
                <Text style={pdfStyles.signatureLabel}>RECEIVED BY ({receiverName || 'CLIENT REPV.'})</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export async function GET(request) {
  // Authenticate user
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date'); // YYYY-MM-DD
    const brandIdQuery = searchParams.get('brandId');
    const dnQuery = searchParams.get('dn'); // Reference Gate Pass No.

    if (!dateQuery || !brandIdQuery || !dnQuery) {
      return new NextResponse('Missing required parameters: date, brandId, dn', { status: 400 });
    }

    let docNo = dnQuery;
    let dateStr = '';
    let brandName = '';
    let receiverName = '';
    let supervisorName = '';
    let notes = '';

    const brandObj = await prisma.brand.findUnique({ where: { id: brandIdQuery } });
    if (brandObj) {
      brandName = brandObj.name;
    }

    const dayStart = new Date(`${dateQuery}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateQuery}T23:59:59.999Z`);

    // Fetch the client return transactions
    const txs = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'CLIENT_RETURN',
        deliveryNote: dnQuery,
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
        product: {
          brandId: brandIdQuery,
        }
      },
      select: {
        id: true,
        notes: true,
        quantity: true,
        receivedBy: true,
        deliverySupervisor: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            category: true,
            isSerialized: true,
          }
        },
        serialNumbers: {
          select: {
            serialNumber: {
              select: {
                barcode: true
              }
            }
          }
        }
      }
    });

    if (txs.length === 0) {
      return new NextResponse('No client return transactions found for specified filters.', { status: 404 });
    }

    if (txs[0]?.notes) {
      notes = txs[0].notes.includes(' | ') ? txs[0].notes.split(' | ')[0] : txs[0].notes;
    }
    receiverName = txs[0].receivedBy || '';
    supervisorName = txs[0].deliverySupervisor?.name || '';

    // Group items by product
    const productGroups = {};
    for (const tx of txs) {
      const prod = tx.product;
      const parsedItemNotes = tx.notes && tx.notes.includes(' | ') ? tx.notes.split(' | ')[1] || '' : (tx.notes || '');
      if (!productGroups[prod.id]) {
        productGroups[prod.id] = {
          productId: prod.id,
          name: prod.name,
          itemCode: prod.itemCode,
          category: prod.category,
          isSerialized: prod.isSerialized,
          quantity: 0,
          serials: [],
          notes: parsedItemNotes
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

    const inventory = Object.values(productGroups);
    const parts = dateQuery.split('-');
    dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;

    // Render react-pdf document to a stream
    const pdfStream = await renderToStream(
      <ClientReturnDocument 
        brandName={brandName}
        inventory={inventory} 
        dateStr={dateStr} 
        docNo={docNo}
        receiverName={receiverName}
        supervisorName={supervisorName}
        notes={notes}
      />
    );

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-ClientReturn-GatePass-${dateStr}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
