import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/new/NewProductClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('category') || line.includes('Category') || line.includes('NORMAL') || line.includes('SIM')) {
    if (idx < 500) {
      console.log(`Line ${idx + 1}: ${line}`);
    }
  }
});
