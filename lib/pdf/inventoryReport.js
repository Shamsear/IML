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
    { key: 'brand', label: 'Brand', weight: 1.3, text: true },
    { key: 'category', label: 'Category', weight: 1.2, text: true },
    { key: 'purchased', label: 'Purchased', weight: 1.0, num: true },
    { key: 'warehouse', label: 'Warehouse', weight: 1.15, num: true, highlight: true },
    { key: 'issued', label: 'Issued', weight: 1.0, num: true },
    { key: 'used', label: 'Used', weight: 1.0, num: true },
    { key: 'damage', label: 'Damage', weight: 0.95, num: true, danger: true },
    { key: 'lost', label: 'Lost', weight: 0.95, num: true, danger: true },
    { key: 'withClient', label: 'With Client', weight: 1.0, num: true },
    { key: 'reBrand', label: 'Rebrand', weight: 1.0, num: true },
    { key: 'total', label: 'Total Stock', weight: 1.15, num: true, highlight: true },
  ];

  // Filter columns based on user selection if specified
  const activeColumns = visibleCols && visibleCols.length > 0
    ? allColumns.filter(c => visibleCols.includes(c.key))
    : allColumns;

  const colCount = activeColumns.length;

  // Dynamic Typography & Sizing based on available space:
  // Spacious (1 - 4 columns), Medium (5 - 7 columns), Dense (8 - 11 columns)
  const isSpacious = colCount <= 4;
  const isMedium = colCount > 4 && colCount <= 7;

  const fontHeader = isSpacious ? 8.5 : (isMedium ? 7.5 : 6.5);
  const fontProduct = isSpacious ? 10 : (isMedium ? 8.5 : 7.2);
  const fontSku = isSpacious ? 7.0 : (isMedium ? 6.2 : 5.5);
  const fontCell = isSpacious ? 8.5 : (isMedium ? 7.5 : 6.5);
  const fontNum = isSpacious ? 9.5 : (isMedium ? 8.2 : 6.8);
  const fontFooter = isSpacious ? 9.0 : (isMedium ? 7.8 : 6.5);
  const imgSize = showImages ? (isSpacious ? 46 : (isMedium ? 40 : 36)) : 0;
  const rowMinHeight = showImages ? (isSpacious ? 52 : (isMedium ? 46 : 42)) : (isSpacious ? 26 : (isMedium ? 22 : 18));
  const rowPadV = isSpacious ? 3.5 : (isMedium ? 3.0 : 2.5);

  // Proportional Column Width Calculation
  const indexWidthPct = isSpacious ? 3.5 : (isMedium ? 3.0 : 2.5);
  const productWidthPct = isSpacious 
    ? (colCount <= 2 ? 52 : 44) 
    : (isMedium ? 34 : 24);

  const remainingWidthPct = 100 - indexWidthPct - productWidthPct;
  const totalActiveWeight = activeColumns.reduce((sum, c) => sum + (c.weight || 1.0), 0);

  const computedColumns = activeColumns.map(col => {
    const wPct = ((col.weight || 1.0) / totalActiveWeight) * remainingWidthPct;
    return {
      ...col,
      width: `${wPct.toFixed(1)}%`
    };
  });

  const colIndexWidth = `${indexWidthPct}%`;
  const colProductWidth = `${productWidthPct}%`;

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
          <View style={[styles.tableHeader, { paddingVertical: isSpacious ? 5.5 : 4 }]} fixed>
            <Text style={[styles.tableHeaderCol, { width: colIndexWidth, textAlign: 'center', fontSize: fontHeader }]}>#</Text>
            <Text style={[styles.tableHeaderCol, { width: colProductWidth, paddingLeft: 6, fontSize: fontHeader }]}>Product Details</Text>
            
            {computedColumns.map(col => (
              <Text 
                key={col.key} 
                style={[
                  styles.tableHeaderCol, 
                  { 
                    width: col.width, 
                    textAlign: col.num ? 'right' : 'left', 
                    paddingLeft: col.num ? 0 : 4,
                    paddingRight: col.num ? 4 : 0,
                    fontSize: fontHeader
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
                  { minHeight: rowMinHeight, paddingVertical: rowPadV }
                ]} 
                wrap={false}
              >
                <Text style={[styles.tableColText, { width: colIndexWidth, textAlign: 'center', color: '#64748b', fontSize: fontCell }]}>
                  {idx + 1}
                </Text>

                <View style={[{ width: colProductWidth, flexDirection: 'row', alignItems: 'center', gap: isSpacious ? 7 : 5, paddingLeft: 6 }]}>
                  {showImages && p.imageUrl ? (
                    <Image 
                      src={p.imageUrl} 
                      style={{
                        width: imgSize,
                        height: imgSize,
                        objectFit: 'contain',
                        borderRadius: 2,
                        borderWidth: 0.5,
                        borderColor: '#cbd5e1',
                        backgroundColor: '#f8fafc',
                      }} 
                    />
                  ) : null}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={[styles.tableColText, { fontWeight: 'bold', color: '#0f172a', fontSize: fontProduct }]}>
                      {p.name}
                    </Text>
                    {p.itemCode ? (
                      <Text style={{ fontSize: fontSku, color: '#64748b', marginTop: isSpacious ? 2 : 1 }}>
                        SKU: {p.itemCode}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {computedColumns.map(col => {
                  if (col.key === 'brand') {
                    return (
                      <Text key="brand" style={[styles.tableColText, { width: col.width, paddingLeft: 4, fontSize: fontCell }]}>
                        {p.brand?.name || p.brandName || '—'}
                      </Text>
                    );
                  }
                  if (col.key === 'category') {
                    return (
                      <Text key="category" style={[styles.tableColText, { width: col.width, paddingLeft: 4, color: '#64748b', fontSize: fontCell }]}>
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
                        { 
                          width: col.width, 
                          color: textColor, 
                          fontWeight: isBold ? 'bold' : 'normal',
                          fontSize: fontNum,
                          paddingRight: 4
                        }
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
          <View style={[styles.tableFooter, { paddingVertical: isSpacious ? 5.5 : 4 }]} wrap={false}>
            <Text style={[styles.tableFooterText, { width: colIndexWidth, textAlign: 'center', fontSize: fontFooter }]}>Σ</Text>
            <Text style={[styles.tableFooterText, { width: colProductWidth, paddingLeft: 6, fontSize: fontFooter }]}>
              GRAND TOTALS ({products.length} Products)
            </Text>

            {computedColumns.map(col => {
              if (col.key === 'brand' || col.key === 'category') {
                return (
                  <Text key={col.key} style={[styles.tableFooterText, { width: col.width, paddingLeft: 4, fontSize: fontFooter }]}>—</Text>
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
                      paddingRight: 4,
                      color: isDanger ? '#dc2626' : (isHighlight ? '#0f766e' : '#0f172a'),
                      fontSize: fontNum
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
