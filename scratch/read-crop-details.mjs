import fs from 'fs';

const content = fs.readFileSync('app/dashboard/products/new/NewProductClient.js', 'utf8');
const lines = content.split('\n');

console.log("=== STATE AND LOGIC ===");
console.log(lines.slice(64, 134).join('\n'));

console.log("\n=== MODAL MARKUP ===");
console.log(lines.slice(1720, 1870).join('\n'));
