'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Download, Calendar, Clock, X, Check, FileSpreadsheet, Sparkles, Filter, ChevronDown, CheckSquare, Square, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';

/**
 * Parses any date/time field or string into a valid Date object or null
 */
function parseRowDate(row) {
  if (!row) return null;
  
  // 1. Direct timestamp / date object
  if (row._rawTimestamp) {
    const d = new Date(row._rawTimestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (row.timestamp) {
    const d = new Date(row.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (row.createdAt) {
    const d = new Date(row.createdAt);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Named date keys
  const dateKeys = ['Date', 'date', 'DateTime', 'dateTime', 'Timestamp', 'Created At', 'Timestamp (Dubai)'];
  for (const key of dateKeys) {
    if (row[key]) {
      const val = row[key];
      if (val instanceof Date && !isNaN(val.getTime())) return val;
      if (typeof val === 'number') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
      }
      if (typeof val === 'string' && val.trim()) {
        const parsed = Date.parse(val);
        if (!isNaN(parsed)) return new Date(parsed);
      }
    }
  }

  // 3. Search object values for any parseable date string
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string' && (v.includes('-') || v.includes('/') || v.includes(',')) && v.length >= 8 && v.length <= 35) {
      const parsed = Date.parse(v);
      if (!isNaN(parsed) && parsed > 946684800000) { // After year 2000
        return new Date(parsed);
      }
    }
  }

  return null;
}

/**
 * Format date to `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`
 */
function toDateTimeLocalString(date) {
  if (!date || isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Reusable Export to Excel component with Date & Time filtering modal, Column Selector, and native embedded binary photos.
 */
export default function ExportToExcel({
  data = [],
  columns = [],
  filename = 'IML-Export',
  sheetName = 'Data',
  headerColor = '0F766E',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'custom'
  const [fromDateTime, setFromDateTime] = useState('');
  const [toDateTime, setToDateTime] = useState('');
  const [embedImages, setEmbedImages] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  
  // Selected columns state (defaults to all columns)
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(() => 
    columns.map(c => c.key || c.header)
  );

  // Sync selected columns when `columns` prop changes
  useEffect(() => {
    setSelectedColumnKeys(columns.map(c => c.key || c.header));
  }, [columns]);

  // Check if any column is an image column
  const isImageColumn = (col) =>
    Boolean(
      col.isImage ||
      col.key === 'imageUrl' ||
      col.key === 'image' ||
      col.key === 'productImage' ||
      col.key === 'Image' ||
      col.header?.toLowerCase() === 'image' ||
      col.header?.toLowerCase() === 'photo' ||
      col.header?.toLowerCase() === 'product image'
    );

  const hasImageCol = useMemo(() => columns.some(isImageColumn), [columns]);

  // Check if the dataset contains date information
  const dateStats = useMemo(() => {
    let hasDates = false;
    let minDate = null;
    let maxDate = null;

    for (const row of data) {
      const d = parseRowDate(row);
      if (d) {
        hasDates = true;
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }

    return { hasDates, minDate, maxDate };
  }, [data]);

  // Initialize from/to dates when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      if (dateStats.minDate && dateStats.maxDate) {
        setFromDateTime(toDateTimeLocalString(dateStats.minDate));
        setToDateTime(toDateTimeLocalString(dateStats.maxDate));
      } else {
        setFromDateTime(toDateTimeLocalString(startOfDay));
        setToDateTime(toDateTimeLocalString(endOfDay));
      }
    }
  }, [isOpen, dateStats]);

  // Filter data according to selected date/time
  const filteredData = useMemo(() => {
    if (filterMode === 'all' || !dateStats.hasDates || (!fromDateTime && !toDateTime)) {
      return data;
    }

    const fromTime = fromDateTime ? new Date(fromDateTime).getTime() : -Infinity;
    const toTime = toDateTime ? new Date(toDateTime).getTime() : Infinity;

    return data.filter((row) => {
      const rowDate = parseRowDate(row);
      if (!rowDate) return true; // Keep if no date present
      const t = rowDate.getTime();
      return t >= fromTime && t <= toTime;
    });
  }, [data, filterMode, dateStats.hasDates, fromDateTime, toDateTime]);

  // Quick preset handlers
  const applyPreset = (preset) => {
    setFilterMode('custom');
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (preset === 'last_30_days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    setFromDateTime(toDateTimeLocalString(start));
    setToDateTime(toDateTimeLocalString(end));
  };

  const toggleColumn = (key) => {
    setSelectedColumnKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one column
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const selectAllColumns = () => {
    setSelectedColumnKeys(columns.map(c => c.key || c.header));
  };

  const executeExport = async () => {
    const exportRows = filteredData;
    if (!exportRows.length || !columns.length) return;

    // Filter active columns based on user column selection
    const activeColumns = columns.filter(c => selectedColumnKeys.includes(c.key || c.header));
    if (!activeColumns.length) return;

    setIsExporting(true);
    setExportProgressText('Preparing Excel workbook...');

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'IML Warehouse System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      // 1. Configure Columns
      worksheet.columns = activeColumns.map((col) => {
        if (isImageColumn(col)) {
          return {
            header: col.header,
            key: col.key || col.header,
            width: col.width || 12,
          };
        }
        const dataWidth = exportRows.reduce((max, row) => {
          const val = String(row[col.key] ?? '');
          return Math.max(max, val.length);
        }, 0);
        return {
          header: col.header,
          key: col.key || col.header,
          width: Math.max(col.width || 12, col.header.length + 3, Math.min(dataWidth + 3, 40)),
        };
      });

      // 2. Style Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${headerColor}` }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // 3. Add Data Rows
      exportRows.forEach((row) => {
        const rowObj = {};
        activeColumns.forEach((col) => {
          if (isImageColumn(col)) {
            rowObj[col.key || col.header] = ''; // blank cell beneath photo
          } else {
            rowObj[col.key || col.header] = row[col.key] ?? '';
          }
        });
        const addedRow = worksheet.addRow(rowObj);
        addedRow.height = (embedImages && hasImageCol) ? 42 : 20;
        addedRow.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        addedRow.alignment = { vertical: 'middle', horizontal: 'left' };
        
        // Align numeric values right
        activeColumns.forEach((col, cIdx) => {
          const val = row[col.key];
          if (typeof val === 'number') {
            addedRow.getCell(cIdx + 1).alignment = { vertical: 'middle', horizontal: 'right' };
          }
        });
      });

      // 4. Fetch & Embed Binary Photos directly into Excel cells
      if (embedImages && hasImageCol) {
        const imageCache = new Map(); // url -> imageId
        const imageCols = activeColumns
          .map((col, idx) => ({ col, idx }))
          .filter(item => isImageColumn(item.col));

        for (let rIdx = 0; rIdx < exportRows.length; rIdx++) {
          const row = exportRows[rIdx];
          
          if ((rIdx + 1) % 5 === 0 || rIdx === 0 || rIdx === exportRows.length - 1) {
            setExportProgressText(`Embedding photos (${rIdx + 1}/${exportRows.length})...`);
          }

          for (const { col, idx: cIdx } of imageCols) {
            let imgUrl = row[col.key];
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim()) {
              imgUrl = imgUrl.trim();
              if (imgUrl.startsWith('/') && typeof window !== 'undefined') {
                imgUrl = window.location.origin + imgUrl;
              }

              try {
                let imageId = imageCache.get(imgUrl);
                if (imageId === undefined) {
                  let buffer = null;
                  let extension = 'png';

                  if (imgUrl.startsWith('data:')) {
                    const parts = imgUrl.split(',');
                    const mime = parts[0].split(';')[0].split(':')[1] || '';
                    if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpeg';
                    const binaryStr = atob(parts[1]);
                    const len = binaryStr.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                      bytes[i] = binaryStr.charCodeAt(i);
                    }
                    buffer = bytes.buffer;
                  } else if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
                    // Use optimized thumbnail size from ImageKit if applicable
                    const fetchUrl = imgUrl.includes('ik.imagekit.io') 
                      ? `${imgUrl}?tr=w-160,h-160,cm-pad_resize` 
                      : imgUrl;

                    const res = await fetch(fetchUrl, { mode: 'cors' });
                    if (res.ok) {
                      buffer = await res.arrayBuffer();
                      const contentType = res.headers.get('content-type') || '';
                      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                        extension = 'jpeg';
                      }
                    }
                  }

                  if (buffer && buffer.byteLength > 0) {
                    imageId = workbook.addImage({
                      buffer: buffer,
                      extension: extension,
                    });
                    imageCache.set(imgUrl, imageId);
                  } else {
                    imageCache.set(imgUrl, null);
                  }
                }

                if (imageId !== null && imageId !== undefined) {
                  worksheet.addImage(imageId, {
                    tl: { col: cIdx + 0.08, row: rIdx + 1.08 },
                    ext: { width: 36, height: 36 },
                    editAs: 'oneCell'
                  });
                }
              } catch (imgErr) {
                console.warn('Failed to embed product photo in excel for row', rIdx, imgErr);
              }
            }
          }
        }
      }

      // 5. Auto-filter
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: exportRows.length + 1, column: activeColumns.length }
      };

      setExportProgressText('Generating Excel file...');

      // 6. Write binary buffer & trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const blobUrl = URL.createObjectURL(blob);

      let fileSuffix = new Date().toISOString().split('T')[0];
      if (filterMode === 'custom' && fromDateTime && toDateTime) {
        const fDate = fromDateTime.split('T')[0];
        const tDate = toDateTime.split('T')[0];
        fileSuffix = fDate === tDate ? `${fDate}_Filtered` : `${fDate}_to_${tDate}`;
      }

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${filename}-${fileSuffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setIsOpen(false);
    } catch (err) {
      console.error('[Excel Export Error]:', err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgressText('');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!data.length}
        className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-surface border border-border hover:bg-surface-elevated text-text-primary font-semibold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer active:scale-98 ${className}`}
      >
        <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />
        <span>Export Excel</span>
        <ChevronDown size={13} className="text-text-muted opacity-70" />
      </button>

      {/* Export Options Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">Export to Excel</h3>
                  <p className="text-xs text-text-secondary">
                    {dateStats.hasDates 
                      ? 'Filter by date, time range, and select columns to include' 
                      : 'Customize columns and export records to Excel'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isExporting && setIsOpen(false)}
                disabled={isExporting}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              
              {/* 1. Date & Time Filtering Options (if date records exist) */}
              {dateStats.hasDates && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Date & Time Filter Range
                  </label>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-surface-elevated border border-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      All Records ({data.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('custom')}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                        filterMode === 'custom'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Specific Date & Time
                    </button>
                  </div>

                  {/* Custom Date & Time Controls */}
                  {filterMode === 'custom' && (
                    <div className="flex flex-col gap-3.5 p-3.5 bg-surface-elevated/60 border border-border rounded-xl">
                      
                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-text-muted mr-1">Presets:</span>
                        {[
                          { id: 'today', label: 'Today' },
                          { id: 'yesterday', label: 'Yesterday' },
                          { id: 'this_week', label: 'This Week' },
                          { id: 'this_month', label: 'This Month' },
                          { id: 'last_30_days', label: 'Last 30 Days' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPreset(p.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-surface border border-border hover:border-primary/40 hover:text-primary rounded-md transition-colors cursor-pointer"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                            <Calendar size={13} className="text-primary" />
                            From Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={fromDateTime}
                            onChange={(e) => setFromDateTime(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                            <Clock size={13} className="text-primary" />
                            To Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={toDateTime}
                            onChange={(e) => setToDateTime(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* 2. Select Columns Section */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Select Columns ({selectedColumnKeys.length} of {columns.length})
                  </label>
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3 bg-surface-elevated/50 border border-border rounded-xl max-h-36 overflow-y-auto">
                  {columns.map((col) => {
                    const key = col.key || col.header;
                    const isSelected = selectedColumnKeys.includes(key);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleColumn(key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                            : 'bg-surface border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={13} className="text-primary shrink-0" />
                        ) : (
                          <Square size={13} className="text-text-muted shrink-0" />
                        )}
                        <span className="truncate">{col.header}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Product Photo Embedding Option */}
              {hasImageCol && selectedColumnKeys.some(k => k === 'Image' || k === 'imageUrl' || k === 'Photo') && (
                <label className="flex items-center gap-3 p-3 bg-surface-elevated/40 border border-border rounded-xl cursor-pointer hover:bg-surface-elevated/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={embedImages}
                    onChange={(e) => setEmbedImages(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">
                      Embed Product Images in Excel Cells
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Embeds the actual product photos directly inside each Excel cell
                    </span>
                  </div>
                </label>
              )}

              {/* Live Count Status Indicator */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs">
                <span className="text-text-secondary font-medium">Matching records for export:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {filteredData.length} of {data.length}
                </span>
              </div>

              {filteredData.length === 0 && (
                <p className="text-xs text-red-500 text-center font-medium">
                  No records match the selected date & time range. Please adjust the range.
                </p>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-t border-border bg-surface-elevated">
              <div className="text-xs text-text-muted font-medium truncate">
                {exportProgressText && (
                  <span className="inline-flex items-center gap-1.5 text-primary font-semibold">
                    <Loader2 size={13} className="animate-spin" />
                    {exportProgressText}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => !isExporting && setIsOpen(false)}
                  disabled={isExporting}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface border border-border hover:bg-surface-elevated rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                
                <button
                  type="button"
                  onClick={executeExport}
                  disabled={filteredData.length === 0 || selectedColumnKeys.length === 0 || isExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Export {filteredData.length} {filteredData.length === 1 ? 'Record' : 'Records'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
