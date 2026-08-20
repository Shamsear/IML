import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/ProductsClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('openAddModal') || line.includes('/products/new') || line.includes('/products/new')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
