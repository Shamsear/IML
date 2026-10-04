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

console.log(`Scanning ${files.length} JS/JSX files for nested component definitions...`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for nested component definition: e.g. function CapitalName(...) or const CapitalName = (...)
    const funcMatch = line.match(/^\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)\s*(=|\()/);
    if (funcMatch) {
      const compName = funcMatch[1];
      // Ignore helper constants or hooks or uppercase object maps if not component JSX
      if (compName.startsWith('USE_') || compName === 'URL' || compName === 'API') return;
      console.log(`${file}:${idx + 1} - Nested component "${compName}": ${line.trim()}`);
    }
  });
});
