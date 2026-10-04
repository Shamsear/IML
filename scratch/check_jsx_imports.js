const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = [...walk('app'), ...walk('components')];
let totalIssues = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Find all JSX components used like <Component
  const jsxRegex = /<([A-Z][A-Za-z0-9_]*)\b/g;
  const usedComponents = new Set();
  let match;
  while ((match = jsxRegex.exec(content)) !== null) {
    usedComponents.add(match[1]);
  }

  // Common globals or React builtins or HTML-like pseudo components
  const builtins = new Set([
    'React', 'Fragment', 'Image', 'Link', 'Head', 'Script'
  ]);

  // Find defined symbols in the file (imports, function declarations, const/let/var declarations)
  const definedSymbols = new Set(builtins);

  // Match import statements
  const importRegex = /import\s+([\s\S]*?)\s+from/g;
  while ((match = importRegex.exec(content)) !== null) {
    const importClause = match[1];
    // Default import or namespace import or destructured imports
    const symbols = importClause.replace(/[{}]/g, ',').split(',');
    symbols.forEach(s => {
      const trimmed = s.trim().split(/\s+as\s+/).pop().trim();
      if (trimmed) definedSymbols.add(trimmed);
    });
  }

  // Match local function or const/let/var declarations
  const declRegex = /(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  while ((match = declRegex.exec(content)) !== null) {
    definedSymbols.add(match[1]);
  }

  // Check each used JSX component
  const missing = [];
  usedComponents.forEach(comp => {
    if (!definedSymbols.has(comp)) {
      missing.push(comp);
    }
  });

  if (missing.length > 0) {
    console.log(`\n❌ [${file}]: Missing JSX component imports/definitions:`);
    missing.forEach(m => console.log(`   - ${m}`));
    totalIssues += missing.length;
  }
});

if (totalIssues === 0) {
  console.log('\n✅ All JSX components across app/ and components/ are properly imported and defined!');
} else {
  console.log(`\n⚠️ Total missing references found: ${totalIssues}`);
}
