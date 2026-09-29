import fs from 'fs';
import path from 'path';

let issuesCount = 0;

function stripComments(str) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

function checkFile(filePath) {
  const rawCode = fs.readFileSync(filePath, 'utf8');
  const code = stripComments(rawCode);

  // 1. Check React hooks
  const reactHooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId', 'useTransition', 'useReducer', 'useDeferredValue'];
  for (const hook of reactHooks) {
    const matches = code.match(new RegExp(`(?<![.\\w])${hook}\\s*\\(`, 'g'));
    if (matches) {
      const hasImport = new RegExp(`import\\s+(?:(?:React\\s*,\\s*\\{[^}]*\\b${hook}\\b[^}]*\\})|(?:\\{[^}]*\\b${hook}\\b[^}]*\\}))\\s+from\\s+['"]react['"]`).test(rawCode) ||
                        new RegExp(`import\\s+\\*\\s+as\\s+React\\s+from\\s+['"]react['"]`).test(rawCode) ||
                        new RegExp(`const\\s+[^=]*\\b${hook}\\b[^=]*=`).test(code) ||
                        new RegExp(`function\\s+${hook}\\b`).test(code);
      if (!hasImport) {
        console.error(`❌ [${filePath}] Missing React hook import: "${hook}"`);
        issuesCount++;
      }
    }
  }

  // 2. Check Next.js navigation hooks
  const navHooks = ['useRouter', 'usePathname', 'useSearchParams', 'useParams'];
  for (const hook of navHooks) {
    const matches = code.match(new RegExp(`(?<![.\\w])${hook}\\s*\\(`, 'g'));
    if (matches) {
      const hasImport = new RegExp(`import\\s+\\{[^}]*\\b${hook}\\b[^}]*\\}\\s+from\\s+['"]next/navigation['"]`).test(rawCode);
      if (!hasImport) {
        console.error(`❌ [${filePath}] Missing Next navigation hook import: "${hook}"`);
        issuesCount++;
      }
    }
  }

  // 3. Check JSX components
  const jsxTagMatches = code.match(/<([A-Z][a-zA-Z0-9_]*)(?:\s|\/|>)/g);
  if (jsxTagMatches) {
    const commonCustomComponents = new Set([
      'Link', 'Image', 'Fragment', 'Suspense', 'StrictMode', 'Icon',
      'Pagination', 'ServerPagination', 'ExportToExcel', 'PageHeader',
      'ConfirmModal', 'DeleteButton', 'EmptyState', 'CustomSelect',
      'ImageLightbox', 'StockBreakdown', 'TransactionActions', 'TabNav',
      'ProductsClient', 'ProductDetailClient', 'NewProductClient',
      'InboundClient', 'InboundLedgerClient',
      'OutboundClient', 'OutboundLedgerClient',
      'ReturnsClient', 'UsedClient', 'RebrandClient', 'DamageClient',
      'BrandsClient', 'BrandDetailClient', 'NewBrandClient', 'EditBrandClient',
      'StoresClient', 'EditStoreClient', 'NewStoreClient',
      'SupervisorsClient', 'EditSupervisorClient', 'NewSupervisorClient',
      'StaffClient', 'AssignStaffClient',
      'ClientReturnsClient', 'ClientReturnsBalancesClient', 'ClientReturnsLedgerClient',
      'ReportsClient', 'BrandPortalClient', 'TransactionsClient', 'EditTransactionClient',
      'DashboardNav', 'Sidebar', 'Header', 'Footer', 'Layout', 'Providers', 'SessionProvider',
      'ScanCompanionClient', 'ToastProvider', 'Toaster'
    ]);

    for (const tagStr of jsxTagMatches) {
      const tag = tagStr.replace(/[<\s\/>]/g, '');
      if (!commonCustomComponents.has(tag)) {
        const isDeclared = new RegExp(`(?:const|function|class|let|var)\\s+${tag}\\b`).test(code) ||
                           new RegExp(`import\\s+(?:${tag}|\\{[^}]*\\b${tag}\\b[^}]*\\})\\s+from`).test(rawCode) ||
                           new RegExp(`icon:\\s*${tag}`).test(code) ||
                           new RegExp(`\\b${tag}\\s*=\\s*`).test(code);
        if (!isDeclared) {
          console.error(`❌ [${filePath}] Component or Icon "${tag}" is used in JSX but NOT imported or defined!`);
          issuesCount++;
        }
      }
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'generated', '.agents'].includes(entry.name)) {
        walk(fullPath);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx')) {
      checkFile(fullPath);
    }
  }
}

console.log('=== RUNNING COMPREHENSIVE LINT & HOOK SCAN ===');
walk('app');
walk('components');
walk('hooks');
walk('lib');

if (issuesCount === 0) {
  console.log('✅ ALL CHECKS PASSED: 0 missing hooks, 0 missing icons, 0 undefined components found.');
} else {
  console.log(`⚠️ Found ${issuesCount} issues.`);
}
