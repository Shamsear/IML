import fs from 'fs';

const content = fs.readFileSync('app/actions/transactions.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('transactionDate') || line.includes('date') || line.includes('timestamp')) {
    if (line.includes('Date') || line.includes('timestamp')) {
      console.log(`Line ${idx + 1}: ${line}`);
    }
  }
});
