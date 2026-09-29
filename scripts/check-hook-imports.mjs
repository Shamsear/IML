import fs from 'fs';
import path from 'path';

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'generated'].includes(entry.name)) {
        checkDir(fullPath);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hooks = ['useEffect', 'useState', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId', 'useTransition'];
      
      for (const hook of hooks) {
        // Look for calls like hook( or hook (
        const regex = new RegExp(`\\b${hook}\\s*\\(`, 'g');
        if (regex.test(content)) {
          // Check if hook is defined/imported in this file
          // 1. import { ... hook ... } from 'react'
          // 2. import React, { ... hook ... } from 'react'
          // 3. const hook = ...
          // 4. function hook ...
          // 5. import * as React from 'react'
          const reactImportMatch = content.match(/import\s+(?:(?:\*\s+as\s+React)|(?:React\s*,\s*\{([^}]+)\})|(?:\{([^}]+)\})|(?:React))\s+from\s+['"]react['"]/);
          
          let imported = false;
          if (reactImportMatch) {
            const namedImports = (reactImportMatch[1] || reactImportMatch[2] || '').split(',').map(s => s.trim());
            if (namedImports.includes(hook) || namedImports.some(s => s.startsWith(hook + ' '))) {
              imported = true;
            }
          }

          // Check if called as React.hook
          const isOnlyReactDot = content.includes(`React.${hook}`);
          const callsCount = (content.match(regex) || []).length;
          const reactDotCallsCount = (content.match(new RegExp(`React\\.${hook}\\s*\\(`, 'g')) || []).length;
          
          if (!imported && callsCount > reactDotCallsCount) {
            console.log(`❌ MISSING IMPORT: "${hook}" in ${fullPath}`);
          }
        }
      }

      // Check router hooks (useRouter, usePathname, useSearchParams)
      const navHooks = ['useRouter', 'usePathname', 'useSearchParams', 'useParams'];
      for (const hook of navHooks) {
        const regex = new RegExp(`\\b${hook}\\s*\\(`, 'g');
        if (regex.test(content)) {
          const isImported = content.includes(hook) && (
            content.includes('next/navigation') || content.includes('next/router')
          );
          if (!isImported) {
            console.log(`❌ MISSING NAVIGATION IMPORT: "${hook}" in ${fullPath}`);
          }
        }
      }
    }
  }
}

console.log('--- SCANNING CODEBASE FOR MISSING HOOKS/IMPORTS ---');
checkDir('app');
checkDir('components');
checkDir('hooks');
checkDir('lib');
console.log('--- SCAN COMPLETE ---');
