import fs from 'fs';

const content = fs.readFileSync('app/actions/transactions.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('staffuniformallocation') || line.toLowerCase().includes('uniformallocation')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
