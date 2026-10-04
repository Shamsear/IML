import path from 'path';
import fs from 'fs';
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Image
} from '@react-pdf/renderer';

// Read logo once at module load time as a base64 data URI
const logoPath = path.join(process.cwd(), 'public', 'IML LOGO V-C.png');
const logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

// Professional Executive PDF Styles
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#0f172a',
  },
  outerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 14,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  topSection: {
    marginBottom: 4,
  },
  // Header Banner
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e2e8f0',
  },
  companyLeft: {
    width: '60%',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'black',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  companySubtext: {
    fontSize: 7.5,
    color: '#64748b',
    lineHeight: 1.3,
  },
  companyContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  companyContact: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  headerRight: {
    width: '38%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoImage: {
    width: 90,
    height: 38,
    objectFit: 'contain',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignSelf: 'flex-end',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'black',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  // Metadata Card
  metaCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    flexDirection: 'row',
    padding: 8,
    marginBottom: 10,
  },
  metaColLeft: {
    width: '52%',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  metaColRight: {
    width: '48%',
    paddingLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3.5,
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
    width: 85,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
  },
  // Table Styling
  tableContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  thSl: {
    width: '6%',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#f8fafc',
    textTransform: 'uppercase',
  },
  thDesc: {
    width: '46%',
    paddingLeft: 6,
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#f8fafc',
    textTransform: 'uppercase',
  },
  thQty: {
    width: '10%',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#f8fafc',
    textTransform: 'uppercase',
  },
  thRemarks: {
    width: '38%',
    paddingLeft: 6,
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#f8fafc',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    minHeight: 22,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableRowOdd: {
    backgroundColor: '#ffffff',
  },
  tdSl: {
    width: '6%',
    textAlign: 'center',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
  },
  tdDesc: {
    width: '46%',
    paddingLeft: 6,
  },
  itemTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  itemSubtext: {
    fontSize: 6.5,
    color: '#475569',
    marginTop: 1.5,
  },
  tdQty: {
    width: '10%',
    textAlign: 'center',
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  tdRemarks: {
    width: '38%',
    paddingLeft: 6,
    fontSize: 7,
    color: '#475569',
  },
  // Footer & Signatures
  footerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  signatureCol: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#94a3b8',
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  footerMetaText: {
    fontSize: 6,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
});

/**
 * Render a high-end corporate delivery note PDF document.
 */
export function DeliveryNoteDocument({
  title = 'DELIVERY NOTE',
  brandName = 'N/A',
  inventory = [],
  dateStr = '',
  docNo = '',
  supplierName = '',
  receiverName = '',
  supervisorName = '',
  contactDetails = '',
  notes = '',
  metaFields = null,
  signatureLabels = [
    { label: 'PREPARED BY' },
    { label: 'CHECKED BY' },
    { label: 'RECEIVED BY' },
  ],
}) {
  // Pad up to 6 rows minimum for clean single-page layout
  const minRows = Math.max(inventory.length, 6);
  const rows = Array.from({ length: minRows }, (_, idx) => inventory[idx] || null);

  // Badge color based on document type
  let badgeBg = '#eff6ff';
  let badgeColor = '#1d4ed8';
  let badgeBorder = '#bfdbfe';

  const tUpper = title.toUpperCase();
  if (tUpper.includes('RETURN')) {
    badgeBg = '#eef2ff';
    badgeColor = '#4338ca';
    badgeBorder = '#c7d2fe';
  } else if (tUpper.includes('RECEIVE')) {
    badgeBg = '#ecfdf5';
    badgeColor = '#047857';
    badgeBorder = '#a7f3d0';
  } else if (tUpper.includes('DAMAGE')) {
    badgeBg = '#fef2f2';
    badgeColor = '#b91c1c';
    badgeBorder = '#fecaca';
  } else if (tUpper.includes('LOSS')) {
    badgeBg = '#fffbeb';
    badgeColor = '#b45309';
    badgeBorder = '#fde68a';
  }

  // Default left and right metadata
  const leftMeta = metaFields?.left ?? [
    { label: 'Warehouse', value: 'IML Warehouse Al qouz' },
    { label: 'Brand', value: brandName },
    ...(supplierName ? [{ label: 'Supplier / Vendor', value: supplierName }] : []),
    ...(receiverName || supervisorName ? [{ label: 'Receiver Name', value: receiverName || supervisorName }] : []),
    ...(notes ? [{ label: 'Notes', value: notes }] : []),
  ];

  const rightMeta = metaFields?.right ?? [
    { label: 'Date', value: dateStr },
    { label: 'Document No', value: docNo },
    ...(contactDetails ? [{ label: 'Contact Details', value: contactDetails }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.outerContainer}>
          <View style={pdfStyles.topSection}>
            {/* Header Banner */}
            <View style={pdfStyles.headerContainer}>
              <View style={pdfStyles.companyLeft}>
                <Text style={pdfStyles.companyName}>THE IML GROUP</Text>
                <Text style={pdfStyles.companySubtext}>P.O. Box | Al Quoz Industrial Area - Dubai, UAE</Text>
                <View style={pdfStyles.companyContactRow}>
                  <Text style={pdfStyles.companyContact}>www.imlme.com</Text>
                  <Text style={pdfStyles.companyContact}>Tel: 04 330 6455</Text>
                </View>
              </View>
              <View style={pdfStyles.headerRight}>
                <Image src={logoSrc} style={pdfStyles.logoImage} />
                <View style={[pdfStyles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                  <Text style={[pdfStyles.badgeText, { color: badgeColor }]}>{title}</Text>
                </View>
              </View>
            </View>

            {/* Metadata Card */}
            <View style={pdfStyles.metaCard}>
              <View style={pdfStyles.metaColLeft}>
                {leftMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`l-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label}:</Text>
                    <Text style={pdfStyles.metaValue}>{field.value || '—'}</Text>
                  </View>
                ))}
              </View>
              <View style={pdfStyles.metaColRight}>
                {rightMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`r-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label}:</Text>
                    <Text style={pdfStyles.metaValue}>{field.value || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Items Table */}
            <View style={pdfStyles.tableContainer}>
              <View style={pdfStyles.tableHeader}>
                <Text style={pdfStyles.thSl}>SL#</Text>
                <Text style={pdfStyles.thDesc}>ITEM DESCRIPTION</Text>
                <Text style={pdfStyles.thQty}>QTY</Text>
                <Text style={pdfStyles.thRemarks}>REMARKS</Text>
              </View>
              {rows.map((item, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <View style={[pdfStyles.tableRow, isEven ? pdfStyles.tableRowEven : pdfStyles.tableRowOdd]} key={idx}>
                    <Text style={pdfStyles.tdSl}>{idx + 1}</Text>
                    <View style={pdfStyles.tdDesc}>
                      {item ? (
                        <View>
                          <Text style={pdfStyles.itemTitle}>{item.name}</Text>
                          {item.subtext ? (
                            <Text style={pdfStyles.itemSubtext}>{item.subtext}</Text>
                          ) : null}
                          {item.isSerialized && item.serials && item.serials.length > 0 && !item.subtext ? (
                            <Text style={pdfStyles.itemSubtext}>
                              Serials: {item.serials.map(s => s.barcode).join(', ')}
                            </Text>
                          ) : null}
                        </View>
                      ) : <Text></Text>}
                    </View>
                    <Text style={pdfStyles.tdQty}>{item ? item.quantity : ''}</Text>
                    <Text style={pdfStyles.tdRemarks}>
                      {item ? (
                        item.isSerialized && item.serials && item.serials.length > 0 && item.subtext
                          ? `Serials: ${item.serials.map(s => s.barcode).join(', ')}`
                          : (item.notes || '')
                      ) : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Footer & Signatures */}
          <View style={pdfStyles.footerContainer}>
            <View style={pdfStyles.signatureRow}>
              {signatureLabels.map((sig, idx) => (
                <View style={pdfStyles.signatureCol} key={idx}>
                  <View style={pdfStyles.signatureLine} />
                  <Text style={pdfStyles.signatureLabel}>{sig.label}</Text>
                </View>
              ))}
            </View>
            <Text style={pdfStyles.footerMetaText}>
              Official Warehouse Inventory Voucher • Generated on {new Date().toLocaleDateString('en-GB')} • IML Group Warehouse Operations
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Format a YYYY-MM-DD date string to DD-MM-YYYY
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
