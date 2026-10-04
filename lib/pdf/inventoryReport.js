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
    paddingTop: 24,
    paddingBottom: 34,
    paddingHorizontal: 22,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
  },
  companyLeft: {
    width: '65%',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f766e',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  companySubtext: {
    fontSize: 7.5,
    color: '#64748b',
    marginBottom: 1,
  },
  logoRight: {
    width: '35%',
    alignItems: 'flex-end',
  },
  logoImage: {
    width: 110,
    height: 36,
    objectFit: 'contain',
  },
  metaContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 7,
    marginBottom: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#475569',
    width: 80,
  },
  metaVal: {
    fontSize: 7.5,
    color: '#0f172a',
    flex: 1,
  },
  // KPI Metrics Summary Cards
  kpiGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 6,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Table styling
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f766e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingVertical: 4.5,
    paddingHorizontal: 3,
  },
  tableHeaderCol: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 3.5,
    paddingHorizontal: 3,
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
    fontSize: 7,
    color: '#334155',
  },
  tableColNum: {
    fontSize: 7,
    color: '#0f172a',
    textAlign: 'right',
    paddingRight: 3,
  },
  // Column Widths (Landscape Layout - total 100%)
  colIndex: { width: '3.5%', textAlign: 'center' },
  colProduct: { width: '25.5%', paddingLeft: 3 },
  colBrand: { width: '10%' },
  colCategory: { width: '9%' },
  colPurchased: { width: '7.5%', textAlign: 'right' },
  colWarehouse: { width: '8.5%', textAlign: 'right' },
  colIssued: { width: '7.5%', textAlign: 'right' },
  colUsed: { width: '6.5%', textAlign: 'right' },
  colClient: { width: '7%', textAlign: 'right' },
  colRebrand: { width: '6.5%', textAlign: 'right' },
  colDamage: { width: '8%', textAlign: 'right' },

  // Summary Footer Row
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderTopWidth: 1.5,
    borderTopColor: '#94a3b8',
    paddingVertical: 4.5,
    paddingHorizontal: 3,
  },
  tableFooterText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 12,
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6.5,
    color: '#94a3b8',
  },
});

function formatNum(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function InventoryReportDocument({
  title = 'INVENTORY STOCK REPORT',
  brandName = 'All Brands',
  categoryName = 'All Categories',
  generatedDate = '',
  products = [],
  summary = {},
}) {
  const totalPurchased = summary.purchased ?? summary.totalPurchased ?? products.reduce((s, p) => s + (p.stock?.purchased ?? p.purchased ?? 0), 0);
  const totalWarehouse = summary.warehouse ?? summary.totalWarehouse ?? products.reduce((s, p) => s + (p.stock?.warehouse ?? p.warehouseStock ?? 0), 0);
  const totalIssued = summary.issued ?? summary.totalIssued ?? products.reduce((s, p) => s + (p.stock?.issued ?? p.issued ?? 0), 0);
  const totalUsed = summary.used ?? summary.totalUsed ?? products.reduce((s, p) => s + (p.stock?.used ?? p.used ?? 0), 0);
  const totalClient = summary.withClient ?? summary.totalClient ?? products.reduce((s, p) => s + (p.stock?.withClient ?? p.withClient ?? 0), 0);
  const totalRebrand = summary.reBrand ?? summary.totalRebrand ?? products.reduce((s, p) => s + (p.stock?.reBrand ?? p.reBrand ?? 0), 0);
  const totalLoss = summary.damage ?? summary.lost ? (summary.damage + summary.lost) : (summary.totalLoss ?? products.reduce((s, p) => s + (p.stock?.damage ?? p.damage ?? 0) + (p.stock?.lost ?? p.lost ?? 0), 0));

  return (
    <Document title="IML-Inventory-Report" author="IML Inventory System">
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 1. Header with Company Details & Logo */}
        <View style={styles.headerRow}>
          <View style={styles.companyLeft}>
            <Text style={styles.reportTitle}>{title}</Text>
            <Text style={styles.companySubtext}>Ideal Movers Logistics · Warehouse & Inventory Management</Text>
            <Text style={styles.companySubtext}>Dubai, United Arab Emirates · Tel: +971 4 250 8731 · info@imlme.com</Text>
          </View>
          <View style={styles.logoRight}>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.logoImage} />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0f766e' }}>IML LOGISTICS</Text>
            )}
          </View>
        </View>

        {/* 2. Metadata Information Block */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCol}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Brand Owner:</Text>
              <Text style={styles.metaVal}>{brandName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Category:</Text>
              <Text style={styles.metaVal}>{categoryName}</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated On:</Text>
              <Text style={styles.metaVal}>{generatedDate || new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total SKUs:</Text>
              <Text style={styles.metaVal}>{products.length} Products in Report</Text>
            </View>
          </View>
        </View>

        {/* 3. KPI Summary Cards */}
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
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, styles.colIndex]}>#</Text>
            <Text style={[styles.tableHeaderCol, styles.colProduct]}>Product & SKU</Text>
            <Text style={[styles.tableHeaderCol, styles.colBrand]}>Brand</Text>
            <Text style={[styles.tableHeaderCol, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderCol, styles.colPurchased]}>Purchased</Text>
            <Text style={[styles.tableHeaderCol, styles.colWarehouse]}>Warehouse</Text>
            <Text style={[styles.tableHeaderCol, styles.colIssued]}>Issued</Text>
            <Text style={[styles.tableHeaderCol, styles.colUsed]}>Used</Text>
            <Text style={[styles.tableHeaderCol, styles.colClient]}>Client</Text>
            <Text style={[styles.tableHeaderCol, styles.colRebrand]}>Rebrand</Text>
            <Text style={[styles.tableHeaderCol, styles.colDamage]}>Damaged/Lost</Text>
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

            return (
              <View key={p.id || idx} style={[styles.tableRow, isEven ? styles.tableRowEven : styles.tableRowOdd]} wrap={false}>
                <Text style={[styles.tableColText, styles.colIndex]}>{idx + 1}</Text>
                <Text style={[styles.tableColText, styles.colProduct, { fontWeight: 'bold' }]}>
                  {p.name} {p.itemCode ? `(${p.itemCode})` : ''}
                </Text>
                <Text style={[styles.tableColText, styles.colBrand]}>{p.brand?.name || p.brandName || '—'}</Text>
                <Text style={[styles.tableColText, styles.colCategory]}>{p.category || '—'}</Text>
                <Text style={[styles.tableColNum, styles.colPurchased]}>{formatNum(purchased)}</Text>
                <Text style={[styles.tableColNum, styles.colWarehouse, { fontWeight: 'bold', color: '#0f766e' }]}>
                  {formatNum(warehouse)}
                </Text>
                <Text style={[styles.tableColNum, styles.colIssued]}>{formatNum(issued)}</Text>
                <Text style={[styles.tableColNum, styles.colUsed]}>{formatNum(used)}</Text>
                <Text style={[styles.tableColNum, styles.colClient]}>{formatNum(withClient)}</Text>
                <Text style={[styles.tableColNum, styles.colRebrand]}>{formatNum(reBrand)}</Text>
                <Text style={[styles.tableColNum, styles.colDamage, damage > 0 ? { color: '#dc2626' } : {}]}>
                  {formatNum(damage)}
                </Text>
              </View>
            );
          })}

          {/* Grand Totals Summary Row */}
          <View style={styles.tableFooter} wrap={false}>
            <Text style={[styles.tableFooterText, styles.colIndex]}>Σ</Text>
            <Text style={[styles.tableFooterText, styles.colProduct]}>GRAND TOTALS ({products.length} Products)</Text>
            <Text style={[styles.tableFooterText, styles.colBrand]}>—</Text>
            <Text style={[styles.tableFooterText, styles.colCategory]}>—</Text>
            <Text style={[styles.tableFooterText, styles.colPurchased, { textAlign: 'right' }]}>{formatNum(totalPurchased)}</Text>
            <Text style={[styles.tableFooterText, styles.colWarehouse, { textAlign: 'right', color: '#0f766e' }]}>{formatNum(totalWarehouse)}</Text>
            <Text style={[styles.tableFooterText, styles.colIssued, { textAlign: 'right' }]}>{formatNum(totalIssued)}</Text>
            <Text style={[styles.tableFooterText, styles.colUsed, { textAlign: 'right' }]}>{formatNum(totalUsed)}</Text>
            <Text style={[styles.tableFooterText, styles.colClient, { textAlign: 'right' }]}>{formatNum(totalClient)}</Text>
            <Text style={[styles.tableFooterText, styles.colRebrand, { textAlign: 'right' }]}>{formatNum(totalRebrand)}</Text>
            <Text style={[styles.tableFooterText, styles.colDamage, { textAlign: 'right', color: '#dc2626' }]}>{formatNum(totalLoss)}</Text>
          </View>
        </View>

        {/* 5. Footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>IML Inventory System · Official Inventory Valuation & Stock Report</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
