import path from 'path';
import fs from 'fs';
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Image
} from '@react-pdf/renderer';

// Read logo once at module load time as a base64 data URI
const logoPath = path.join(process.cwd(), 'public', 'IML LOGO V-C.png');
const logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

// Professional Executive Corporate PDF Styles
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 28,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#111827',
  },
  docContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'space-between',
  },
  // Company Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    marginBottom: 8,
  },
  headerLeft: {
    width: '60%',
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'black',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.3,
  },
  companyContacts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  companyContactText: {
    fontSize: 7.5,
    color: '#334155',
    fontWeight: 'bold',
  },
  headerRight: {
    width: '38%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoImage: {
    width: 95,
    height: 36,
    objectFit: 'contain',
    marginBottom: 4,
  },
  titleBadge: {
    backgroundColor: '#0f172a',
    paddingVertical: 3.5,
    paddingHorizontal: 12,
    borderRadius: 3,
    alignSelf: 'flex-end',
  },
  titleBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'black',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Metadata Details Block
  metaBlock: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  metaLeftCol: {
    width: '56%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  metaRightCol: {
    width: '44%',
    padding: 6,
    backgroundColor: '#f8fafc',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
    alignItems: 'flex-start',
  },
  metaLabel: {
    width: 82,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  metaValue: {
    flex: 1,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  // Table Styling with Complete Professional Grid Lines
  table: {
    borderWidth: 1,
    borderColor: '#0f172a',
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    minHeight: 19,
    alignItems: 'center',
  },
  thSl: {
    width: '6%',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    paddingVertical: 3,
  },
  thDesc: {
    width: '48%',
    paddingLeft: 6,
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    paddingVertical: 3,
  },
  thQty: {
    width: '10%',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    paddingVertical: 3,
  },
  thRemarks: {
    width: '36%',
    paddingLeft: 6,
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#ffffff',
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 20,
    alignItems: 'stretch',
  },
  tdSl: {
    width: '6%',
    textAlign: 'center',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#475569',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    paddingVertical: 3,
    justifyContent: 'center',
  },
  tdDesc: {
    width: '48%',
    paddingLeft: 6,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    paddingVertical: 3,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  itemSubtext: {
    fontSize: 6.5,
    color: '#475569',
    marginTop: 1,
  },
  tdQty: {
    width: '10%',
    textAlign: 'center',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    paddingVertical: 3,
    justifyContent: 'center',
  },
  tdRemarks: {
    width: '36%',
    paddingLeft: 6,
    paddingRight: 4,
    fontSize: 7,
    color: '#334155',
    paddingVertical: 3,
    justifyContent: 'center',
  },
  // Table Summary Row
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    minHeight: 18,
    alignItems: 'center',
  },
  totalLabelCell: {
    width: '54%',
    textAlign: 'right',
    paddingRight: 10,
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#0f172a',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  totalQtyCell: {
    width: '10%',
    textAlign: 'center',
    fontWeight: 'black',
    fontSize: 8.5,
    color: '#0f172a',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  totalEmptyCell: {
    width: '36%',
    paddingLeft: 6,
    fontSize: 6.5,
    color: '#64748b',
    fontWeight: 'bold',
  },
  // Notes / Terms Box
  notesBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 6,
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 6.5,
    color: '#475569',
    lineHeight: 1.3,
  },
  // Clean Simple Signatures Section
  signaturesSection: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureCol: {
    width: '28%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  signatureDate: {
    fontSize: 6.5,
    color: '#64748b',
    textAlign: 'center',
  },
  // Bottom Page Info
  bottomFooter: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 3,
  },
  footerText: {
    fontSize: 6,
    color: '#94a3b8',
  },
});

/**
 * Render a classic executive corporate delivery / return note PDF document.
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
    { label: 'DELIVERED BY' },
    { label: 'CHECKED BY' },
    { label: 'RECEIVED BY (WH)' },
  ],
}) {
  // Standard full-page voucher uses 15 structured grid rows so the page is proportioned with zero awkward blank voids
  const totalGridRows = Math.max(inventory.length, 15);
  const rows = Array.from({ length: totalGridRows }, (_, idx) => inventory[idx] || null);

  // Total items & quantity
  const totalQty = inventory.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const totalItemCount = inventory.length;

  // Title badge background styling based on document nature
  let badgeBg = '#0f172a';
  const tUpper = title.toUpperCase();
  if (tUpper.includes('RETURN')) {
    badgeBg = '#1e1b4b'; // Deep Indigo
  } else if (tUpper.includes('RECEIVE') || tUpper.includes('INBOUND')) {
    badgeBg = '#064e3b'; // Deep Emerald
  } else if (tUpper.includes('DAMAGE')) {
    badgeBg = '#7f1d1d'; // Deep Crimson
  } else if (tUpper.includes('LOSS')) {
    badgeBg = '#78350f'; // Deep Amber
  }

  // Metadata mappings
  const leftMeta = metaFields?.left ?? [
    { label: 'Warehouse', value: 'IML Warehouse Al Quoz' },
    { label: 'Brand', value: brandName },
    ...(supplierName ? [{ label: 'Store / Source', value: supplierName }] : []),
    ...(receiverName || supervisorName ? [{ label: 'Supervisor', value: receiverName || supervisorName }] : []),
  ];

  const rightMeta = metaFields?.right ?? [
    { label: 'Document No', value: docNo },
    { label: 'Date', value: dateStr },
    ...(contactDetails ? [{ label: 'Contact', value: contactDetails }] : []),
    ...(notes ? [{ label: 'Notes', value: notes }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.docContainer}>
          <View>
            {/* Header */}
            <View style={pdfStyles.headerRow}>
              <View style={pdfStyles.headerLeft}>
                <Text style={pdfStyles.companyName}>THE IML GROUP</Text>
                <Text style={pdfStyles.companyAddress}>P.O. Box | Al Quoz Industrial Area - Dubai, United Arab Emirates</Text>
                <View style={pdfStyles.companyContacts}>
                  <Text style={pdfStyles.companyContactText}>Tel: 04 330 6455</Text>
                  <Text style={pdfStyles.companyContactText}>•</Text>
                  <Text style={pdfStyles.companyContactText}>Web: www.imlme.com</Text>
                  <Text style={pdfStyles.companyContactText}>•</Text>
                  <Text style={pdfStyles.companyContactText}>TRN: 100234567800003</Text>
                </View>
              </View>
              <View style={pdfStyles.headerRight}>
                <Image src={logoSrc} style={pdfStyles.logoImage} />
                <View style={[pdfStyles.titleBadge, { backgroundColor: badgeBg }]}>
                  <Text style={pdfStyles.titleBadgeText}>{title}</Text>
                </View>
              </View>
            </View>

            {/* Metadata Block */}
            <View style={pdfStyles.metaBlock}>
              <View style={pdfStyles.metaLeftCol}>
                {leftMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`l-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label}:</Text>
                    <Text style={pdfStyles.metaValue}>{field.value || '—'}</Text>
                  </View>
                ))}
              </View>
              <View style={pdfStyles.metaRightCol}>
                {rightMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`r-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label}:</Text>
                    <Text style={pdfStyles.metaValue}>{field.value || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Table */}
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={pdfStyles.thSl}>SL#</Text>
                <Text style={pdfStyles.thDesc}>ITEM DESCRIPTION</Text>
                <Text style={pdfStyles.thQty}>QTY</Text>
                <Text style={pdfStyles.thRemarks}>REMARKS / SERIAL NUMBERS</Text>
              </View>

              {rows.map((item, idx) => (
                <View style={pdfStyles.tableRow} key={idx}>
                  <View style={pdfStyles.tdSl}>
                    <Text>{idx + 1}</Text>
                  </View>
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
                    ) : <Text style={{ fontSize: 7, color: '#ffffff' }}>{'\u00A0'}</Text>}
                  </View>
                  <View style={pdfStyles.tdQty}>
                    <Text>{item ? item.quantity : '\u00A0'}</Text>
                  </View>
                  <View style={pdfStyles.tdRemarks}>
                    <Text>
                      {item ? (
                        item.isSerialized && item.serials && item.serials.length > 0 && item.subtext
                          ? `Serials: ${item.serials.map(s => s.barcode).join(', ')}`
                          : (item.notes || '\u00A0')
                      ) : '\u00A0'}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Total Row */}
              <View style={pdfStyles.tableTotalRow}>
                <Text style={pdfStyles.totalLabelCell}>TOTAL ({totalItemCount} Line Item{totalItemCount === 1 ? '' : 's'}):</Text>
                <Text style={pdfStyles.totalQtyCell}>{totalQty}</Text>
                <Text style={pdfStyles.totalEmptyCell}>Units Verified & Confirmed</Text>
              </View>
            </View>

            {/* Notes & Warehouse Terms Box */}
            <View style={pdfStyles.notesBox}>
              <Text style={pdfStyles.notesTitle}>Instructions & Warehouse Declaration:</Text>
              <Text style={pdfStyles.notesText}>
                • Received the above materials in good order and condition. Any discrepancy or damage must be officially reported to warehouse management within 24 hours of receipt.
              </Text>
            </View>
          </View>

          {/* Bottom Section (Clean Simple Signatures + Footer) */}
          <View>
            {/* Clean Simple Signatures Section */}
            <View style={pdfStyles.signaturesSection}>
              <View style={pdfStyles.signatureRow}>
                {signatureLabels.map((sig, idx) => (
                  <View style={pdfStyles.signatureCol} key={idx}>
                    <View style={pdfStyles.signatureLine} />
                    <Text style={pdfStyles.signatureLabel}>{sig.label}</Text>
                    <Text style={pdfStyles.signatureDate}>Date: ____ / ____ / 2026</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom Footer */}
            <View style={pdfStyles.bottomFooter}>
              <Text style={pdfStyles.footerText}>IML Group Official Warehouse Operations • Voucher Ref: {docNo || 'N/A'}</Text>
              <Text style={pdfStyles.footerText}>Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
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
