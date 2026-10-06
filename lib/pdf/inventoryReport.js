import path from 'path';
import fs from 'fs';
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Image
} from '@react-pdf/renderer';

// Read logo once at module load time as a base64 data URI
let logoSrc = null;
try {
  const logoPath = path.join(process.cwd(), 'public', 'IML LOGO V-C.png');
  if (fs.existsSync(logoPath)) {
    logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  }
} catch (e) {
  console.error('Could not load logo for PDF report:', e);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingBottom: 22,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#0f172a',
  },
  // Document Top Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
  },
  headerLeft: {
    width: '68%',
  },
  reportBadge: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1.5,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 1.5,
  },
  companySubtext: {
    fontSize: 6.5,
    color: '#64748b',
    lineHeight: 1.25,
  },
  headerRight: {
    width: '32%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoImage: {
    width: 105,
    height: 32,
    objectFit: 'contain',
  },

  // Metadata Info Strip
  metaContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  metaCol: {
    flex: 1,
  },
  metaItem: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#64748b',
    width: 70,
  },
  metaVal: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
  },

  // Table Styling
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
    marginBottom: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f766e',
    borderBottomWidth: 1,
    borderBottomColor: '#0d5f58',
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  tableHeaderCol: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    minHeight: 18,
    alignItems: 'center',
  },
  tableRowWithImage: {
    minHeight: 44,
    paddingVertical: 3,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableRowOdd: {
    backgroundColor: '#ffffff',
  },
  tableColText: {
    fontSize: 6.5,
    color: '#334155',
  },
  tableColNum: {
    fontSize: 6.5,
    color: '#0f172a',
    textAlign: 'right',
    paddingRight: 2,
  },
  productImageThumb: {
    width: 38,
    height: 38,
    objectFit: 'contain',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },

  // Summary Footer Row
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1.5,
    borderTopColor: '#0f766e',
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  tableFooterText: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // Fixed Page Footer
  pageFooter: {
    position: 'absolute',
    bottom: 8,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.8,
    borderTopColor: '#e2e8f0',
    paddingTop: 2.5,
  },
  footerText: {
    fontSize: 5.5,
    color: '#94a3b8',
  },
});

function formatNum(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function InventoryReportDocument({
  title = 'GLOBAL STOCK SUMMARY REPORT',
  brandName = 'All Brands',
  categoryName = 'All Categories',
  generatedDate = '',
  products = [],
  summary = {},
  showImages = false,
  visibleCols = null, // optional array of active column keys
}) {
  const totalPurchased = summary.purchased ?? products.reduce((s, p) => s + (p.stock?.purchased ?? p.purchased ?? 0), 0);
  const totalWarehouse = summary.warehouse ?? products.reduce((s, p) => s + (p.stock?.warehouse ?? p.warehouseStock ?? 0), 0);
  const totalIssued = summary.issued ?? products.reduce((s, p) => s + (p.stock?.issued ?? p.issued ?? 0), 0);
  const totalUsed = summary.used ?? products.reduce((s, p) => s + (p.stock?.used ?? p.used ?? 0), 0);
  const totalDamage = summary.damage ?? products.reduce((s, p) => s + (p.stock?.damage ?? p.damage ?? 0), 0);
  const totalLost = summary.lost ?? products.reduce((s, p) => s + (p.stock?.lost ?? p.lost ?? 0), 0);
  const totalClient = summary.withClient ?? products.reduce((s, p) => s + (p.stock?.withClient ?? p.withClient ?? 0), 0);
  const totalRebrand = summary.reBrand ?? products.reduce((s, p) => s + (p.stock?.reBrand ?? p.reBrand ?? 0), 0);
  const totalAvailable = totalWarehouse;

  // Define All Available Columns (matching Report Table exactly)
  const allColumns = [
    { key: 'brand', label: 'Brand', width: '8.5%', text: true },
    { key: 'category', label: 'Category', width: '7.5%', text: true },
    { key: 'purchased', label: 'Purchased', width: '6.5%', num: true },
    { key: 'warehouse', label: 'Warehouse', width: '7.5%', num: true, highlight: true },
    { key: 'issued', label: 'Issued', width: '6.5%', num: true },
    { key: 'used', label: 'Used', width: '6.5%', num: true },
    { key: 'damage', label: 'Damage', width: '6%', num: true, danger: true },
    { key: 'lost', label: 'Lost', width: '6%', num: true, danger: true },
    { key: 'withClient', label: 'With Client', width: '6.5%', num: true },
    { key: 'reBrand', label: 'Rebrand', width: '6.5%', num: true },
    { key: 'total', label: 'Total Stock', width: '7.5%', num: true, highlight: true },
  ];

  // Filter columns based on user selection if specified
  const activeColumns = visibleCols && visibleCols.length > 0
    ? allColumns.filter(c => visibleCols.includes(c.key))
    : allColumns;

  // Fixed Index Column
  const colIndexWidth = '2.5%';
  
  // Remaining width dynamically allocated to Product column
  const allocatedWidth = activeColumns.reduce((sum, c) => sum + parseFloat(c.width), 0);
  const productWidthPct = Math.max(100 - (2.5 + allocatedWidth), 22);
  const colProductWidth = `${productWidthPct.toFixed(1)}%`;

  return (
    <Document title="IML-Stock-Summary-Report" author="IML Warehouse System">
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* 1. Header with Company Details & Logo */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportBadge}>OFFICIAL INVENTORY VALUATION & STOCK SUMMARY</Text>
            <Text style={styles.reportTitle}>{title}</Text>
            <Text style={styles.companySubtext}>Ideal Movers Logistics · Central Warehouse Al Quoz, Dubai, UAE</Text>
            <Text style={styles.companySubtext}>Tel: +971 4 330 6455 · Email: info@imlme.com · Web: www.imlme.com</Text>
          </View>
          <View style={styles.headerRight}>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.logoImage} />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f766e' }}>IML LOGISTICS</Text>
            )}
          </View>
        </View>

        {/* 2. Metadata Info Box */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCol}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Brand Owner:</Text>
              <Text style={styles.metaVal}>{brandName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Category Scope:</Text>
              <Text style={styles.metaVal}>{categoryName}</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated On:</Text>
              <Text style={styles.metaVal}>
                {generatedDate || new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total SKUs:</Text>
              <Text style={styles.metaVal}>{products.length} Products Documented</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Warehouse:</Text>
              <Text style={styles.metaVal}>IML Al Quoz Central</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Photos Mode:</Text>
              <Text style={[styles.metaVal, { color: showImages ? '#0f766e' : '#64748b' }]}>
                {showImages ? 'Product Photos Included' : 'Compact Text View'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Products Table */}
        <View style={styles.table}>
          {/* Table Header (repeats on every page via fixed prop) */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCol, { width: colIndexWidth, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.tableHeaderCol, { width: colProductWidth, paddingLeft: 4 }]}>Product Details</Text>
            
            {activeColumns.map(col => (
              <Text 
                key={col.key} 
                style={[
                  styles.tableHeaderCol, 
                  { 
                    width: col.width, 
                    textAlign: col.num ? 'right' : 'left', 
                    paddingLeft: col.num ? 0 : 2,
                    paddingRight: col.num ? 2 : 0
                  }
                ]}
              >
                {col.label}
              </Text>
            ))}
          </View>

          {/* Table Rows */}
          {products.map((p, idx) => {
            const isEven = idx % 2 === 0;
            const purchased = p.stock?.purchased ?? p.purchased ?? 0;
            const warehouse = p.stock?.warehouse ?? p.warehouseStock ?? 0;
            const issued = p.stock?.issued ?? p.issued ?? 0;
            const used = p.stock?.used ?? p.used ?? 0;
            const damage = p.stock?.damage ?? p.damage ?? 0;
            const lost = p.stock?.lost ?? p.lost ?? 0;
            const withClient = p.stock?.withClient ?? p.withClient ?? 0;
            const reBrand = p.stock?.reBrand ?? p.reBrand ?? 0;
            const total = warehouse;

            const valuesMap = {
              purchased,
              warehouse,
              issued,
              used,
              damage,
              lost,
              withClient,
              reBrand,
              total,
            };

            return (
              <View 
                key={p.id || idx} 
                style={[
                  styles.tableRow, 
                  isEven ? styles.tableRowEven : styles.tableRowOdd, 
                  showImages ? styles.tableRowWithImage : {}
                ]} 
                wrap={false}
              >
                <Text style={[styles.tableColText, { width: colIndexWidth, textAlign: 'center', color: '#64748b' }]}>
                  {idx + 1}
                </Text>

                <View style={[{ width: colProductWidth, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4 }]}>
                  {showImages && p.imageUrl ? (
                    <Image 
                      src={p.imageUrl} 
                      style={styles.productImageThumb} 
                    />
                  ) : null}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={[styles.tableColText, { fontWeight: 'bold', color: '#0f172a', fontSize: 7 }]}>{p.name}</Text>
                    {p.itemCode ? (
                      <Text style={{ fontSize: 5.5, color: '#64748b', marginTop: 1 }}>SKU: {p.itemCode}</Text>
                    ) : null}
                  </View>
                </View>

                {activeColumns.map(col => {
                  if (col.key === 'brand') {
                    return (
                      <Text key="brand" style={[styles.tableColText, { width: col.width, paddingLeft: 2 }]}>
                        {p.brand?.name || p.brandName || '—'}
                      </Text>
                    );
                  }
                  if (col.key === 'category') {
                    return (
                      <Text key="category" style={[styles.tableColText, { width: col.width, paddingLeft: 2, color: '#64748b' }]}>
                        {p.category || '—'}
                      </Text>
                    );
                  }

                  const val = valuesMap[col.key] ?? 0;
                  let textColor = '#0f172a';
                  let isBold = false;
                  if (col.highlight) {
                    textColor = '#0f766e';
                    isBold = true;
                  } else if (col.danger && val > 0) {
                    textColor = '#dc2626';
                    isBold = true;
                  }

                  return (
                    <Text 
                      key={col.key} 
                      style={[
                        styles.tableColNum, 
                        { width: col.width, color: textColor, fontWeight: isBold ? 'bold' : 'normal' }
                      ]}
                    >
                      {formatNum(val)}
                    </Text>
                  );
                })}
              </View>
            );
          })}

          {/* Grand Totals Summary Row */}
          <View style={styles.tableFooter} wrap={false}>
            <Text style={[styles.tableFooterText, { width: colIndexWidth, textAlign: 'center' }]}>Σ</Text>
            <Text style={[styles.tableFooterText, { width: colProductWidth, paddingLeft: 4 }]}>
              GRAND TOTALS ({products.length} Products)
            </Text>

            {activeColumns.map(col => {
              if (col.key === 'brand' || col.key === 'category') {
                return (
                  <Text key={col.key} style={[styles.tableFooterText, { width: col.width, paddingLeft: 2 }]}>—</Text>
                );
              }

              const totalsMap = {
                purchased: totalPurchased,
                warehouse: totalWarehouse,
                issued: totalIssued,
                used: totalUsed,
                damage: totalDamage,
                lost: totalLost,
                withClient: totalClient,
                reBrand: totalRebrand,
                total: totalAvailable,
              };

              const totVal = totalsMap[col.key] ?? 0;
              const isDanger = col.danger && totVal > 0;
              const isHighlight = col.highlight;

              return (
                <Text 
                  key={col.key} 
                  style={[
                    styles.tableFooterText, 
                    { 
                      width: col.width, 
                      textAlign: 'right', 
                      paddingRight: 2,
                      color: isDanger ? '#dc2626' : (isHighlight ? '#0f766e' : '#0f172a')
                    }
                  ]}
                >
                  {formatNum(totVal)}
                </Text>
              );
            })}
          </View>
        </View>

        {/* 5. Fixed Page Footer with Page Numbers */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>
            IML Inventory Management System · Central Stock Valuation & Distribution Audit
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
