import fs from 'fs';

const content = fs.readFileSync('app/actions/transactions.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('createBulkDamageTransactions') || line.includes('function createBulkDamageTransactions')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
