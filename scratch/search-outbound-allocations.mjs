import fs from 'fs';

const content = fs.readFileSync('app/dashboard/outbound/OutboundClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('allocatedItems')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
