import fs from 'fs';
import path from 'path';

function walk(dir, results = []) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git')) {
        walk(fullPath, results);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('/dashboard/staff/assign')) {
          results.push(fullPath);
        }
      }
    }
  });
  return results;
}

const found = walk('.');
console.log("Found links in:", found);
