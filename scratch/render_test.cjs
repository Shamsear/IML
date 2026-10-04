const { DeliveryNoteDocument } = require('../lib/pdf/deliveryNote.js');
const ReactPDF = require('@react-pdf/renderer');
const React = require('react');
const path = require('path');

async function test() {
  const sampleInventory = [
    {
      name: 'Sadia LogoT Shirts "Extra Large" (Yellow)',
      quantity: 2,
      isSerialized: false,
      subtext: 'Promoter: John Doe (+971 50 123 4567) | Size: XL | Period: 01/10/2026 - 15/10/2026',
      notes: ''
    },
    {
      name: 'Sadia Acrylic Display Stand 4-Tier',
      quantity: 1,
      isSerialized: true,
      serials: [{ barcode: 'SAD-STND-9921' }],
      subtext: '',
      notes: 'Returned from promotional kiosk'
    }
  ];

  const doc = React.createElement(DeliveryNoteDocument, {
    title: 'RETURN NOTE',
    brandName: 'Sadia',
    inventory: sampleInventory,
    dateStr: '04-10-2026',
    docNo: 'RET-SAD-041026-007',
    metaFields: {
      left: [
        { label: 'Warehouse', value: 'IML Warehouse Al Quoz' },
        { label: 'Brand', value: 'Sadia' },
        { label: 'Store', value: 'Union Cooperative Society - Jumeirah (Dubai)' },
        { label: 'Supervisor', value: 'Vineeth' }
      ],
      right: [
        { label: 'Date', value: '04-10-2026' },
        { label: 'Document No', value: 'RET-SAD-041026-007' }
      ]
    },
    signatureLabels: [
      { label: 'RETURNED BY' },
      { label: 'CHECKED BY' },
      { label: 'RECEIVED BY (WH)' }
    ]
  });

  const outPath = path.join(__dirname, 'test_out.pdf');
  await ReactPDF.renderToFile(doc, outPath);
  console.log('PDF generated at:', outPath);
}

test().catch(console.error);
