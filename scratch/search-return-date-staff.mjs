import fs from 'fs';

const content = fs.readFileSync('app/dashboard/staff/StaffClient.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('returnDate') || line.includes('Return Date')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
