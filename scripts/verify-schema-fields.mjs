import fs from 'fs';
import path from 'path';

// Extract valid fields per model from schema.prisma
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const models = {};
let currentModel = null;

schema.split('\n').forEach(line => {
  const trimmed = line.trim();
  const mMatch = trimmed.match(/^model\s+(\w+)\s+\{/);
  if (mMatch) {
    currentModel = mMatch[1];
    models[currentModel] = new Set();
    const camel = currentModel[0].toLowerCase() + currentModel.slice(1);
    models[camel] = models[currentModel];
    return;
  }
  if (trimmed === '}') {
    currentModel = null;
    return;
  }
  if (currentModel && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('@@')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      models[currentModel].add(parts[0]);
    }
  }
});

// Check specific action files
const actionFiles = [
  'app/actions/products.js',
  'app/actions/transactions.js',
  'app/actions/brands.js',
  'app/actions/stores.js',
  'app/actions/supervisors.js',
  'app/actions/staff.js'
];

actionFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  console.log(`Checking file: ${file}`);
  
  // Find all prisma/tx calls with data: { ... }
  const regex = /(?:prisma|tx)\.([a-zA-Z0-9_]+)\.(create|update|createMany|updateMany)\s*\(\s*\{[\s\S]*?data:\s*(\{[\s\S]*?\})/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const model = match[1];
    const op = match[2];
    const dataBlock = match[3];
    const validFields = models[model];
    if (!validFields) {
      console.log(`  [UNKNOWN MODEL] ${model}`);
      continue;
    }
    
    // Extract keys in dataBlock (simple top-level keys)
    const keyMatches = dataBlock.match(/^\s*([a-zA-Z0-9_]+)\s*:/gm);
    if (keyMatches) {
      keyMatches.forEach(km => {
        const key = km.replace(/[:\s]/g, '');
        if (!validFields.has(key)) {
          console.warn(`  [FIELD MISMATCH] Model '${model}' in ${op} has invalid field: '${key}'`);
        }
      }
    )}
  }
});

console.log('Action fields verification done.');
