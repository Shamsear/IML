import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/ProductsClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('isReturnable') && (line.includes('checked') || line.includes('onChange') || line.includes('radio') || line.includes('label'))) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
