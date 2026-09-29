import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
const traverse = traversePkg.default || traversePkg;

// 1. Extract schema fields
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

// Map model relations
const relations = {
  user: [],
  brand: ['products', 'stores'],
  product: ['brand', 'transactions', 'serialNumbers'],
  supervisor: ['allocations', 'deliveries'],
  store: ['staff', 'brands', 'allocations'],
  staff: ['store', 'allocations'],
  staffUniformAllocation: ['staff', 'store', 'supervisor'],
  productSerialNumber: ['replaces', 'replacedBy', 'product', 'transactions'],
  inventoryTransaction: ['deliverySupervisor', 'product', 'serialNumbers'],
  transactionSerialNumber: ['transaction', 'serialNumber'],
  pushSubscription: [],
  scanSession: []
};

const actionFiles = [
  'app/actions/products.js',
  'app/actions/transactions.js',
  'app/actions/brands.js',
  'app/actions/stores.js',
  'app/actions/supervisors.js',
  'app/actions/staff.js',
  'lib/ledger.js'
];

let errorCount = 0;

for (const file of actionFiles) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    console.error(`Error parsing ${file}:`, err.message);
    continue;
  }

  traverse(ast, {
    CallExpression(astPath) {
      const callee = astPath.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'MemberExpression' &&
        ['prisma', 'tx'].includes(callee.object.object?.name)
      ) {
        const modelName = callee.object.property.name;
        const method = callee.property.name;
        const validFields = models[modelName];

        if (!validFields) {
          console.error(`[UNKNOWN MODEL] ${file}:${astPath.node.loc?.start.line} -> ${modelName}.${method}`);
          errorCount++;
          return;
        }

        if (['create', 'update', 'upsert'].includes(method)) {
          const arg = astPath.node.arguments[0];
          if (arg && arg.type === 'ObjectExpression') {
            const dataProp = arg.properties.find(p => p.key?.name === 'data');
            if (dataProp && dataProp.value?.type === 'ObjectExpression') {
              for (const prop of dataProp.value.properties) {
                if (prop.type === 'ObjectProperty') {
                  const keyName = prop.key.name || prop.key.value;
                  if (!validFields.has(keyName)) {
                    console.error(`[INVALID FIELD] ${file}:${prop.loc?.start.line} -> ${modelName}.${method} has non-existent field "${keyName}"`);
                    errorCount++;
                  }
                }
              }
            }
          }
        }
      }
    }
  });
}

console.log(`\nAST Verification finished. Found ${errorCount} errors.`);
