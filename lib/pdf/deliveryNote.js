import path from 'path';
import fs from 'fs';
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, renderToStream, Image
} from '@react-pdf/renderer';

// Read logo once at module load time as a base64 data URI
const logoPath = path.join(process.cwd(), 'public', 'IML LOGO V-C.png');
const logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

// Shared styles — identical across all delivery note types
export const pdfStyles = StyleSheet.create({
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

/**
 * Render a delivery note PDF document.
 *
 * @param {Object} config
 * @param {string} config.title - Document title (e.g. "RECEIVE NOTE")
 * @param {string} config.brandName
 * @param {Array} config.inventory - Array of { name, quantity, isSerialized, serials, notes }
 * @param {string} config.dateStr - Formatted date string
 * @param {string} config.docNo - Document number
 * @param {string} [config.supplierName]
 * @param {string} [config.receiverName]
 * @param {string} [config.contactDetails]
 * @param {string} [config.notes]
 * @param {Array<{label: string}>} [config.signatureLabels] - Defaults to PREPARED BY, CHECKED BY, RECEIVED BY
 */
export function DeliveryNoteDocument({
  title = 'DELIVERY NOTE',
  brandName = 'N/A',
  inventory = [],
  dateStr = '',
  docNo = '',
  supplierName = '',
  receiverName = '',
  contactDetails = '',
  notes = '',
  metaFields = null,
  signatureLabels = [
    { label: 'PREPARED BY' },
    { label: 'CHECKED BY' },
    { label: 'RECEIVED BY' },
  ],
}) {
  const totalTableRows = 28;
  const rows = Array.from({ length: totalTableRows }, (_, idx) => inventory[idx] || null);

  // Default meta fields or custom
  const leftMeta = metaFields?.left ?? [
    { label: 'Warehouse', value: 'IML Warehouse Al qouz' },
    { label: 'Brand', value: brandName },
    ...(supplierName ? [{ label: 'Supplier', value: supplierName }] : []),
    ...(receiverName ? [{ label: 'Receiver Name', value: receiverName }] : []),
    { label: 'Notes', value: notes },
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
            <Text style={pdfStyles.docTitle}>{title}</Text>

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

            <View style={pdfStyles.metaBox}>
              <View style={pdfStyles.metaLeft}>
                {leftMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`l-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label} :-</Text>
                    <Text style={pdfStyles.metaVal}>{field.value || ''}</Text>
                  </View>
                ))}
              </View>
              <View style={pdfStyles.metaRight}>
                {rightMeta.map((field, idx) => (
                  <View style={pdfStyles.metaRow} key={`r-${idx}`}>
                    <Text style={pdfStyles.metaLabel}>{field.label} :-</Text>
                    <Text style={pdfStyles.metaVal}>{field.value || ''}</Text>
                  </View>
                ))}
              </View>
            </View>

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
                    {item ? <Text style={{ fontWeight: 'bold' }}>{item.name}</Text> : <Text></Text>}
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

          <View style={pdfStyles.footerBox}>
            <View style={pdfStyles.signatureRow}>
              {signatureLabels.map((sig, idx) => (
                <View style={pdfStyles.signatureCol} key={idx}>
                  <Text style={pdfStyles.dashedText}>------------------------</Text>
                  <Text style={pdfStyles.signatureLabel}>{sig.label}</Text>
                </View>
              ))}
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
  const parts = dateStr.split('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
