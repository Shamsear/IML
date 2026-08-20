import fs from 'fs';

const files = [
  'app/dashboard/inbound/InboundClient.js',
  'app/dashboard/outbound/OutboundClient.js',
  'app/dashboard/damage/DamageClient.js',
  'app/dashboard/rebrand/RebrandClient.js',
  'app/dashboard/products/new/NewProductClient.js'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('type="date"') || line.includes("type='date'")) {
        console.log(`${file} Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
