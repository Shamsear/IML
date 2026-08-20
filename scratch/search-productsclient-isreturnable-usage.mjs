import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/ProductsClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('isReturnable') || line.includes('setIsReturnable') || line.includes('Returnable / Disposable')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
