'use client';

import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Reusable Export to Excel button.
 *
 * @param {Object[]} data - Array of row objects to export
 * @param {Object[]} columns - Column definitions: [{ header: 'Label', key: 'fieldName', width?: number }]
 * @param {string} filename - Download filename without extension (e.g. "IML-Inbound-Ledger")
 * @param {string} sheetName - Sheet tab name (default: "Data")
 * @param {string} className - Optional extra classes for the button
 */
export default function ExportToExcel({
  data = [],
  columns = [],
  filename = 'IML-Export',
  sheetName = 'Data',
  className = '',
}) {
  const handleExport = () => {
    if (!data.length) return;

    // Build worksheet data using column keys
    const rows = data.map((row) => {
      const obj = {};
      columns.forEach((col) => {
        obj[col.header] = row[col.key] ?? '';
      });
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = columns.map((col) => ({ wch: col.width || 18 }));

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${filename}-${today}.xlsx`);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data.length}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-primary font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <Download size={16} />
      Export Excel
    </button>
  );
}
