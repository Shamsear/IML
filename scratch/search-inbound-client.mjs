import fs from 'fs';

const content = fs.readFileSync('app/dashboard/inbound/InboundClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('productType') || line.includes('Product Type') || line.includes('NORMAL')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
