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
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 22,
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
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
  },
  headerLeft: {
    width: '65%',
  },
  reportBadge: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  companySubtext: {
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.3,
  },
  headerRight: {
    width: '35%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoImage: {
    width: 110,
    height: 34,
    objectFit: 'contain',
  },

  // Metadata Info Strip
  metaContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  metaCol: {
    flex: 1,
  },
  metaItem: {
    flexDirection: 'row',
    marginBottom: 1.5,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748b',
    width: 75,
  },
  metaVal: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
  },

  // KPI Metrics Summary Cards
  kpiGrid: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  kpiValue: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 5.5,
    color: '#94a3b8',
    marginTop: 0.5,
  },

  // Table Styling
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f766e',
    borderBottomWidth: 1,
    borderBottomColor: '#0d5f58',
    paddingVertical: 4.5,
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
    paddingVertical: 3,
    paddingHorizontal: 2,
    minHeight: 16,
    alignItems: 'center',
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

  // Summary Footer Row
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1.5,
    borderTopColor: '#0f766e',
    paddingVertical: 4.5,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  tableFooterText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // Fixed Page Footer
  pageFooter: {
    position: 'absolute',
    bottom: 10,
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.8,
    borderTopColor: '#e2e8f0',
    paddingTop: 3,
  },
  footerText: {
    fontSize: 6,
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
  const totalPurchased = summary.purchased ?? summary.totalPurchased ?? products.reduce((s, p) => s + (p.stock?.purchased ?? p.purchased ?? 0), 0);
  const totalWarehouse = summary.warehouse ?? summary.totalWarehouse ?? products.reduce((s, p) => s + (p.stock?.warehouse ?? p.warehouseStock ?? 0), 0);
  const totalIssued = summary.issued ?? summary.totalIssued ?? products.reduce((s, p) => s + (p.stock?.issued ?? p.issued ?? 0), 0);
  const totalUsed = summary.used ?? summary.totalUsed ?? products.reduce((s, p) => s + (p.stock?.used ?? p.used ?? 0), 0);
  const totalClient = summary.withClient ?? summary.totalClient ?? products.reduce((s, p) => s + (p.stock?.withClient ?? p.withClient ?? 0), 0);
  const totalRebrand = summary.reBrand ?? summary.totalRebrand ?? products.reduce((s, p) => s + (p.stock?.reBrand ?? p.reBrand ?? 0), 0);
  const totalLoss = summary.damage ?? summary.lost ? (summary.damage + summary.lost) : (summary.totalLoss ?? products.reduce((s, p) => s + (p.stock?.damage ?? p.damage ?? 0) + (p.stock?.lost ?? p.lost ?? 0), 0));
  const totalAvailable = totalWarehouse;

  // Define All Available Metric Columns
  const allColumns = [
    { key: 'purchased', label: 'Purchased', width: '7%', num: true },
    { key: 'warehouse', label: 'Warehouse', width: '8.5%', num: true, highlight: true },
    { key: 'issued', label: 'Issued (Stores)', width: '8%', num: true },
    { key: 'used', label: 'Used / Consumed', width: '7.5%', num: true },
    { key: 'withClient', label: 'With Client', width: '7%', num: true },
    { key: 'reBrand', label: 'Rebrand', width: '7%', num: true },
    { key: 'damage', label: 'Damaged/Lost', width: '8%', num: true, danger: true },
    { key: 'total', label: 'Total Available', width: '8%', num: true, highlight: true },
  ];

  // Filter columns based on user selection if specified
  const activeMetrics = visibleCols && visibleCols.length > 0
    ? allColumns.filter(c => visibleCols.includes(c.key))
    : allColumns;

  // Base fixed columns: #, Product & SKU, Brand, Category
  const colIndexWidth = '3.5%';
  const colBrandWidth = '9.5%';
  const colCategoryWidth = '8.5%';
  
  // Remaining width dynamically allocated to Product column
  const allocatedMetricsWidth = activeMetrics.reduce((sum, c) => sum + parseFloat(c.width), 0);
  const productWidthPct = Math.max(100 - (3.5 + 9.5 + 8.5 + allocatedMetricsWidth), 22);
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

        {/* 3. KPI Summary Strip */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Initial Inbound</Text>
            <Text style={styles.kpiValue}>{formatNum(totalPurchased)}</Text>
            <Text style={styles.kpiSub}>Total Purchased</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: '#0f766e', backgroundColor: '#f0fdfa' }]}>
            <Text style={[styles.kpiLabel, { color: '#0f766e' }]}>Warehouse Stock</Text>
            <Text style={[styles.kpiValue, { color: '#0f766e' }]}>{formatNum(totalWarehouse)}</Text>
            <Text style={styles.kpiSub}>Available Central</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Outbound / Stores</Text>
            <Text style={styles.kpiValue}>{formatNum(totalIssued)}</Text>
            <Text style={styles.kpiSub}>Issued to Outlets</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Staff / Used</Text>
            <Text style={styles.kpiValue}>{formatNum(totalUsed)}</Text>
            <Text style={styles.kpiSub}>Promoter Custody</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>With Client</Text>
            <Text style={styles.kpiValue}>{formatNum(totalClient)}</Text>
            <Text style={styles.kpiSub}>Brand Custody</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Rebrand</Text>
            <Text style={styles.kpiValue}>{formatNum(totalRebrand)}</Text>
            <Text style={styles.kpiSub}>Converted/Pending</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: '#ef4444' }]}>
            <Text style={[styles.kpiLabel, { color: '#dc2626' }]}>Damaged / Lost</Text>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{formatNum(totalLoss)}</Text>
            <Text style={styles.kpiSub}>Total Write-offs</Text>
          </View>
        </View>

        {/* 4. Products Table */}
        <View style={styles.table}>
          {/* Table Header (repeats on every page via fixed prop) */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCol, { width: colIndexWidth, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.tableHeaderCol, { width: colProductWidth, paddingLeft: 4 }]}>Product Description & SKU</Text>
            <Text style={[styles.tableHeaderCol, { width: colBrandWidth, paddingLeft: 2 }]}>Brand</Text>
            <Text style={[styles.tableHeaderCol, { width: colCategoryWidth, paddingLeft: 2 }]}>Category</Text>
            
            {activeMetrics.map(col => (
              <Text key={col.key} style={[styles.tableHeaderCol, { width: col.width, textAlign: 'right', paddingRight: 3 }]}>
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
            const withClient = p.stock?.withClient ?? p.withClient ?? 0;
            const reBrand = p.stock?.reBrand ?? p.reBrand ?? 0;
            const damage = (p.stock?.damage ?? p.damage ?? 0) + (p.stock?.lost ?? p.lost ?? 0);
            const total = warehouse;

            const valuesMap = {
              purchased,
              warehouse,
              issued,
              used,
              withClient,
              reBrand,
              damage,
              total,
            };

            return (
              <View 
                key={p.id || idx} 
                style={[
                  styles.tableRow, 
                  isEven ? styles.tableRowEven : styles.tableRowOdd, 
                  showImages ? { minHeight: 26, paddingVertical: 2.5 } : {}
                ]} 
                wrap={false}
              >
                <Text style={[styles.tableColText, { width: colIndexWidth, textAlign: 'center', color: '#64748b' }]}>
                  {idx + 1}
                </Text>

                <View style={[{ width: colProductWidth, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 }]}>
                  {showImages && p.imageUrl ? (
                    <Image 
                      src={p.imageUrl} 
                      style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 2, borderWidth: 0.5, borderColor: '#cbd5e1' }} 
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tableColText, { fontWeight: 'bold', color: '#0f172a' }]}>{p.name}</Text>
                    {p.itemCode ? (
                      <Text style={{ fontSize: 5.5, color: '#64748b', marginTop: 0.5 }}>SKU: {p.itemCode}</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={[styles.tableColText, { width: colBrandWidth, paddingLeft: 2 }]}>
                  {p.brand?.name || p.brandName || '—'}
                </Text>
                <Text style={[styles.tableColText, { width: colCategoryWidth, paddingLeft: 2, color: '#64748b' }]}>
                  {p.category || '—'}
                </Text>

                {activeMetrics.map(col => {
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
            <Text style={[styles.tableFooterText, { width: colBrandWidth, paddingLeft: 2 }]}>—</Text>
            <Text style={[styles.tableFooterText, { width: colCategoryWidth, paddingLeft: 2 }]}>—</Text>

            {activeMetrics.map(col => {
              const totalsMap = {
                purchased: totalPurchased,
                warehouse: totalWarehouse,
                issued: totalIssued,
                used: totalUsed,
                withClient: totalClient,
                reBrand: totalRebrand,
                damage: totalLoss,
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
