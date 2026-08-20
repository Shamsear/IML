import fs from 'fs';

const content = fs.readFileSync('app/actions/products.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('productType') || line.includes('isSerialized') || line.includes('NORMAL') || line.includes('createProduct')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
