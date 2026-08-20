import fs from 'fs';

const content = fs.readFileSync('app/actions/staff.js', 'utf8');
const lines = content.split('\n');

let startIndex = -1;
lines.forEach((line, idx) => {
  if (line.includes('saveCombinedAllocation') || line.includes('saveBulkCombinedAllocations')) {
    startIndex = idx;
  }
});

if (startIndex !== -1) {
  console.log(lines.slice(startIndex, startIndex + 150).join('\n'));
} else {
  console.log("Not found");
}
