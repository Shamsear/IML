'use client';

import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Reusable Export to Excel button with professional styling.
 *
 * Features:
 *  - Bold styled headers with colored background
 *  - Borders on all cells
 *  - Alternating row colors
 *  - Frozen header row
 *  - Auto-fitted column widths
 *  - Date stamp in filename
 *
 * @param {Object[]} data - Array of row objects to export
 * @param {Object[]} columns - Column definitions: [{ header, key, width?, color? }]
 * @param {string} filename - Download filename without extension
 * @param {string} [sheetName] - Sheet tab name (default: "Data")
 * @param {string} [headerColor] - Hex color for header background (default: "0F766E" — teal)
 * @param {string} [className] - Extra classes on the button
 */
export default function ExportToExcel({
  data = [],
  columns = [],
  filename = 'IML-Export',
  sheetName = 'Data',
  headerColor = '0F766E',
  className = '',
}) {
  const handleExport = () => {
    if (!data.length || !columns.length) return;

    // Build worksheet data
    const rows = data.map((row) => {
      const obj = {};
      columns.forEach((col) => {
        obj[col.header] = row[col.key] ?? '';
      });
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.header) });

    // ─── Styling ──────────────────────────────────────────────────────

    // 1. Column widths (auto-fit with minimum)
    ws['!cols'] = columns.map((col) => {
      const dataWidth = data.reduce((max, row) => {
        const val = String(row[col.key] ?? '');
        return Math.max(max, val.length);
      }, 0);
      const headerWidth = col.header.length;
      return { wch: Math.max(col.width || 12, headerWidth + 2, dataWidth + 2) };
    });

    // 2. Cell styles via !cols (widths done above) and custom cell objects
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Style header row (row 0)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          fill: { fgColor: { rgb: headerColor }, patternType: 'solid' },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'medium', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: 'D1D5DB' } },
            right: { style: 'thin', color: { rgb: 'D1D5DB' } },
          },
        };
      }
    }

    // Style data rows
    for (let r = 1; r <= range.e.r; r++) {
      const isEven = r % 2 === 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 10 },
            fill: isEven
              ? { fgColor: { rgb: 'F3F4F6' }, patternType: 'solid' }
              : undefined,
            alignment: { vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
              left: { style: 'thin', color: { rgb: 'E5E7EB' } },
              right: { style: 'thin', color: { rgb: 'E5E7EB' } },
            },
          };
        }
      }
    }

    // 3. Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // 4. Auto-filter on header
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: range.e.c },
      }),
    };

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${filename}-${today}.xlsx`);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data.length}
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-surface border border-border hover:bg-surface-elevated text-text-primary font-semibold text-xs sm:text-sm rounded-lg shadow-sm hover:shadow transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
    >
      <Download size={16} />
      Export Excel
    </button>
  );
}
