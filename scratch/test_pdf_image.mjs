import React from 'react';
import ReactPDF, { Document, Page, Text, View, Image } from '@react-pdf/renderer';

const doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4' },
    React.createElement(
      View,
      { style: { padding: 20 } },
      React.createElement(Text, { style: { fontSize: 14, marginBottom: 10 } }, 'PDF Image Test'),
      React.createElement(Image, {
        src: 'https://ik.imagekit.io/iml/sadia_products/PROD-SAD-001.png',
        style: { width: 60, height: 60, objectFit: 'contain' }
      })
    )
  )
);

async function run() {
  const stream = await ReactPDF.renderToStream(doc);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  console.log('PDF rendered successfully! Size:', buffer.length, 'bytes');
}

run().catch(console.error);
