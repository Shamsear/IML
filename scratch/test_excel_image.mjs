import * as XLSX from 'xlsx';

const wb = XLSX.utils.book_new();

const data = [
  { Product: 'Sadia Promotional Stand (1*1) - Mortadella', SKU: 'PROD-SAD-001', Qty: 10, imageUrl: 'https://ik.imagekit.io/iml/sadia_products/PROD-SAD-001.png' },
  { Product: 'Sadia Promotional Stand (DCC) - Generic', SKU: 'PROD-SAD-003', Qty: 5, imageUrl: 'https://ik.imagekit.io/iml/sadia_products/PROD-SAD-003.png' }
];

const columns = [
  { header: 'Image', key: 'imageUrl', isImage: true, width: 15 },
  { header: 'Product Name', key: 'Product', width: 40 },
  { header: 'SKU / Item Code', key: 'SKU', width: 18 },
  { header: 'Quantity', key: 'Qty', width: 12 }
];

// Build worksheet rows
const rows = data.map(row => {
  const obj = {};
  columns.forEach(col => {
    obj[col.header] = row[col.key] ?? '';
  });
  return obj;
});

const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.header) });

// Insert Excel formula =IMAGE("url") for image cells
data.forEach((row, rIdx) => {
  columns.forEach((col, cIdx) => {
    if (col.isImage && row[col.key]) {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx });
      // In Excel formula: =IMAGE("https://...")
      ws[cellRef] = {
        t: 's',
        f: `IMAGE("${row[col.key]}")`,
        v: ''
      };
    }
  });
});

// Set row heights so images are nice and visible (e.g. 60pt)
ws['!rows'] = [{ hpt: 24 }, ...data.map(() => ({ hpt: 60 }))];

XLSX.utils.book_append_sheet(wb, ws, 'Products');
XLSX.writeFile(wb, 'scratch/test_export.xlsx');
console.log('Excel file generated successfully with IMAGE() formulas and row heights!');
