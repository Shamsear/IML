import fs from 'fs';

const content = fs.readFileSync('app/dashboard/damage/DamageClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('type="') || line.includes("type='") || line.includes('date') || line.includes('Date')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
