import fs from 'fs';

const content = fs.readFileSync('app/actions/transactions.js', 'utf8');
const lines = content.split('\n');

let startIndex = -1;
lines.forEach((line, idx) => {
  if (line.includes('export async function createBulkIssueTransactions')) {
    startIndex = idx;
  }
});

console.log("createBulkIssueTransactions index is " + (startIndex + 1));
