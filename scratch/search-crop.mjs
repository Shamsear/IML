import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/new/NewProductClient.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('crop') || line.toLowerCase().includes('canvas')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
