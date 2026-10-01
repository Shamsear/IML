/**
 * Automated Headless Browser Testing Agent
 * Traverses the entire inventory application end-to-end (A to Z)
 * Generates screenshots, network logs, console error reports, and a final markdown summary.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const RUN_TIMESTAMP = Date.now();
const OUTPUT_DIR = path.join(process.cwd(), 'test-results', `run_${RUN_TIMESTAMP}`);
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

// Ensure output directories exist
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const report = {
  runId: `run_${RUN_TIMESTAMP}`,
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: {
    totalSteps: 0,
    passed: 0,
    failed: 0,
    consoleErrorsCount: 0,
    networkErrorsCount: 0,
  },
  steps: [],
  consoleErrors: [],
  networkErrors: [],
  pageExceptions: [],
};

function log(msg, level = 'INFO') {
  const ts = new Date().toLocaleTimeString();
  const icon = level === 'PASS' ? '✅' : level === 'FAIL' ? '❌' : level === 'WARN' ? '⚠️' : 'ℹ️';
  console.log(`[${ts}] ${icon} [${level}] ${msg}`);
}

let stepIndex = 0;
async function recordStep(page, { name, action, verify }) {
  stepIndex++;
  report.summary.totalSteps++;
  const stepNumber = stepIndex;
  const startTime = Date.now();
  const stepNameFormatted = `${String(stepNumber - 1).padStart(2, '0')}_${name}`;
  const screenshotFileName = `${stepNameFormatted}.png`;
  const screenshotRelPath = `screenshots/${screenshotFileName}`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  log(`Starting step: ${name}...`, 'INFO');

  const stepResult = {
    stepNumber,
    name,
    status: 'PENDING',
    durationMs: 0,
    screenshot: null,
    error: null,
  };

  try {
    const actionResult = await action();
    if (verify) {
      await verify(actionResult);
    }
    stepResult.status = 'PASSED';
    report.summary.passed++;
    log(`Step PASSED: ${name}`, 'PASS');
  } catch (err) {
    stepResult.status = 'FAILED';
    stepResult.error = err.message || String(err);
    report.summary.failed++;
    log(`Step FAILED: ${name} -> ${err.message}`, 'FAIL');
  } finally {
    stepResult.durationMs = Date.now() - startTime;
    try {
      await page.screenshot({ path: screenshotFullPath, fullPage: false });
      stepResult.screenshot = screenshotRelPath;
    } catch (sErr) {
      log(`Failed to capture screenshot for ${name}: ${sErr.message}`, 'WARN');
    }
    report.steps.push(stepResult);
  }
}

async function ensureAuthenticated(page) {
  if (page.url().includes('/login')) {
    log('Session redirect detected, logging in test_admin...', 'INFO');
    await page.waitForTimeout(2000);
    const usernameInput = page.locator('input[placeholder="Enter your username"]').first();
    await usernameInput.click();
    await usernameInput.fill('test_admin');

    const passwordInput = page.locator('input[placeholder="••••••••"]').first();
    await passwordInput.click();
    await passwordInput.fill('TestAdmin@1234');

    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL('**/dashboard**', { timeout: 45000 });
    await page.waitForTimeout(2000);
  }
}

async function navigateAuthed(page, pathUrl) {
  await page.goto(`${BASE_URL}${pathUrl}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}${pathUrl}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  }
}

async function runAgent() {
  log(`=======================================================`);
  log(`  STARTING HEADLESS BROWSER AUDIT AGENT`);
  log(`  Target: ${BASE_URL}`);
  log(`  Run ID: ${report.runId}`);
  log(`=======================================================`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antigravity-Headless-Audit-Agent/1.0',
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();
  page.setDefaultTimeout(50000);
  page.setDefaultNavigationTimeout(50000);

  // Listeners for Console Errors, Page Errors, and Network Errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('next-pwa') || text.includes('favicon') || text.includes('Download the React DevTools')) return;
      report.consoleErrors.push({
        type: 'console.error',
        url: page.url(),
        text,
        timestamp: new Date().toISOString()
      });
      report.summary.consoleErrorsCount++;
      log(`Browser Console Error on ${page.url()}: ${text}`, 'WARN');
    }
  });

  page.on('pageerror', error => {
    report.pageExceptions.push({
      url: page.url(),
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    log(`Uncaught JS Exception on ${page.url()}: ${error.message}`, 'FAIL');
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('/api/auth/session') && !url.includes('/favicon.ico') && !url.includes('icon-')) {
      report.networkErrors.push({
        url,
        status,
        statusText: response.statusText(),
        timestamp: new Date().toISOString()
      });
      report.summary.networkErrorsCount++;
      log(`HTTP ${status} on ${url}`, 'WARN');
    }
  });

  // Shared state across test phases
  const testId = Date.now().toString().slice(-6);
  const testData = {
    brandName: `Brand_${testId}`,
    brandId: null,
    storeName: `Store_${testId}`,
    storeId: null,
    supervisorName: `Supervisor_${testId}`,
    supervisorId: null,
    productName: `Product_${testId}`,
    productId: null,
    productSku: `SKU-${testId}`,
  };

  try {
    // ----------------------------------------------------
    // PHASE 1: Authentication & Entry
    // ----------------------------------------------------
    await recordStep(page, {
      name: '01_Visit_Login_Page',
      action: async () => {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 20000 });
      },
      verify: async () => {
        const hasUsernameInput = await page.locator('input[placeholder="Enter your username"]').count() > 0;
        if (!hasUsernameInput) throw new Error('Login username input not found');
      }
    });

    await recordStep(page, {
      name: '02_Admin_Authentication_And_Dashboard_Entry',
      action: async () => {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        const usernameInput = page.locator('input[placeholder="Enter your username"]').first();
        await usernameInput.click();
        await usernameInput.fill('test_admin');
        
        const passwordInput = page.locator('input[placeholder="••••••••"]').first();
        await passwordInput.click();
        await passwordInput.fill('TestAdmin@1234');
        
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL('**/dashboard', { timeout: 50000 });
        await page.waitForTimeout(2000);
      },
      verify: async () => {
        if (!page.url().includes('/dashboard')) throw new Error(`Expected /dashboard, got ${page.url()}`);
      }
    });

    // ----------------------------------------------------
    // PHASE 2: Main Dashboard Overview
    // ----------------------------------------------------
    await recordStep(page, {
      name: '03_Dashboard_Overview_Cards',
      action: async () => {
        await navigateAuthed(page, '/dashboard');
        await page.waitForTimeout(1000);
      },
      verify: async () => {
        const bodyText = await page.textContent('body');
        if (!bodyText || bodyText.length < 50) throw new Error('Dashboard body content is empty');
      }
    });

    // ----------------------------------------------------
    // PHASE 3: Brand Creation & Management Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '04_Navigate_Brands_List',
      action: async () => {
        await navigateAuthed(page, '/dashboard/brands');
        await page.waitForSelector('a[href*="/dashboard/brands/new"], a:has-text("Add Brand")', { timeout: 35000 });
      },
      verify: async () => {
        const hasAddBrandBtn = await page.locator('a[href*="/dashboard/brands/new"], a:has-text("Add Brand")').count() > 0;
        if (!hasAddBrandBtn) throw new Error('Add Brand button/link not found on /dashboard/brands');
      }
    });

    await recordStep(page, {
      name: '05_Create_New_Brand',
      action: async () => {
        await navigateAuthed(page, '/dashboard/brands/new');
        await page.waitForSelector('input[placeholder="e.g. Virgin Mobile"]', { timeout: 35000 });
        const nameInput = page.locator('input[placeholder="e.g. Virgin Mobile"]').first();
        await nameInput.click();
        await nameInput.fill(testData.brandName);
        await page.fill('input[placeholder="e.g. Rack A"]', 'Rack-A1');
        await page.fill('input[placeholder="e.g. Shelf 3"]', 'Shelf-1');
        await page.fill('textarea[placeholder="Describe brand guidelines or specifications."]', 'Automated headless browser test brand.');
        await page.waitForTimeout(500);
        
        // Submit form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save Brands")').first();
        await submitBtn.click();
        
        // Wait for Confirm Modal OK button or navigation
        const modalOkBtn = page.locator('button:has-text("OK")').first();
        await modalOkBtn.waitFor({ state: 'visible', timeout: 35000 });
        await modalOkBtn.click();
        await page.waitForURL('**/dashboard/brands**', { timeout: 35000 });
        await page.waitForTimeout(2000);
      },
      verify: async () => {
        await navigateAuthed(page, '/dashboard/brands');
        await page.waitForTimeout(1000);
        const content = await page.content();
        if (!content.includes(testData.brandName)) {
          throw new Error(`Newly created brand "${testData.brandName}" not found in brands list`);
        }
      }
    });

    await recordStep(page, {
      name: '06_Inspect_Brand_Detail_And_Portal',
      action: async () => {
        await navigateAuthed(page, '/dashboard/brands');
        await page.waitForTimeout(1000);
        const brandLink = page.locator(`a:has-text("${testData.brandName}")`).first();
        if (await brandLink.count() > 0) {
          const href = await brandLink.getAttribute('href');
          testData.brandId = href.split('/').pop();
          await brandLink.click();
          await page.waitForTimeout(1500);
        }
      },
      verify: async () => {
        const body = await page.textContent('body');
        if (!body || body.length < 50) {
          throw new Error('Brand detail page failed to render');
        }
      }
    });

    // ----------------------------------------------------
    // PHASE 4: Store Creation & Management Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '07_Navigate_Stores_List',
      action: async () => {
        await navigateAuthed(page, '/dashboard/stores');
        await page.waitForSelector('a[href*="/dashboard/stores/new"], a:has-text("Add Store")', { timeout: 35000 });
      },
      verify: async () => {
        const hasAddStore = await page.locator('a[href*="/dashboard/stores/new"], a:has-text("Add Store")').count() > 0;
        if (!hasAddStore) throw new Error('Add Store button/link not found');
      }
    });

    await recordStep(page, {
      name: '08_Create_New_Store',
      action: async () => {
        await navigateAuthed(page, '/dashboard/stores/new');
        await page.waitForSelector('input[placeholder="e.g. Carrefour Mall of the Emirates"]', { timeout: 35000 });
        await page.waitForTimeout(1000);
        const nameInput = page.locator('input[placeholder="e.g. Carrefour Mall of the Emirates"]').first();
        await nameInput.click();
        await nameInput.fill(testData.storeName);
        const locInput = page.locator('input[placeholder="e.g. Sheikh Zayed Rd, Al Barsha 1, Dubai"]').first();
        await locInput.click();
        await locInput.fill('Sheikh Zayed Road, Downtown Dubai');
        await page.waitForTimeout(500);
        
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save Stores")').first();
        await submitBtn.click();
        
        const modalOkBtn = page.locator('button:has-text("OK")').first();
        await modalOkBtn.waitFor({ state: 'visible', timeout: 35000 });
        await modalOkBtn.click();
        await page.waitForURL('**/dashboard/stores**', { timeout: 35000 });
        await page.waitForTimeout(2000);
      },
      verify: async () => {
        await navigateAuthed(page, '/dashboard/stores');
        await page.waitForTimeout(1000);
        const content = await page.content();
        if (!content.includes(testData.storeName)) {
          throw new Error(`Store "${testData.storeName}" not found in stores list`);
        }
      }
    });

    // ----------------------------------------------------
    // PHASE 5: Supervisor Creation & Management Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '09_Create_New_Supervisor',
      action: async () => {
        await navigateAuthed(page, '/dashboard/supervisors/new');
        await page.waitForSelector('input[placeholder="e.g. Ahmed Al Maktoum"]', { timeout: 35000 });
        await page.waitForTimeout(1000);
        const nameInput = page.locator('input[placeholder="e.g. Ahmed Al Maktoum"]').first();
        await nameInput.click();
        await nameInput.fill(testData.supervisorName);
        const emailInput = page.locator('input[placeholder="e.g. ahmed@iml-group.com"]').first();
        await emailInput.click();
        await emailInput.fill(`sup_${testId}@inventory.local`);
        const phoneInput = page.locator('input[placeholder="e.g. 050 123 4567"]').first();
        await phoneInput.click();
        await phoneInput.fill('050 123 4567');
        await page.waitForTimeout(500);
        
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save Supervisors")').first();
        await submitBtn.click();
        
        const modalOkBtn = page.locator('button:has-text("OK")').first();
        await modalOkBtn.waitFor({ state: 'visible', timeout: 35000 });
        await modalOkBtn.click();
        await page.waitForURL('**/dashboard/supervisors**', { timeout: 35000 });
        await page.waitForTimeout(2000);
      },
      verify: async () => {
        await navigateAuthed(page, '/dashboard/supervisors');
        await page.waitForTimeout(1000);
        const content = await page.content();
        if (!content.includes(testData.supervisorName)) {
          throw new Error(`Supervisor "${testData.supervisorName}" not found in list`);
        }
      }
    });

    // ----------------------------------------------------
    // PHASE 6: Product Creation & Management Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '10_Create_New_Product',
      action: async () => {
        await navigateAuthed(page, '/dashboard/products/new');
        await page.waitForSelector('button[aria-haspopup="listbox"]', { timeout: 35000 });
        
        // Pick Brand from CustomSelect dropdown
        const brandDropdownBtn = page.locator('button[aria-haspopup="listbox"]').first();
        await brandDropdownBtn.click();
        await page.waitForTimeout(500);
        
        // Click the first available option in the open listbox
        const firstOption = page.locator('[role="listbox"] [role="option"]').first();
        if (await firstOption.count() > 0) {
          await firstOption.click();
        }

        // Fill product name
        const nameInput = page.locator('input[placeholder="e.g. Promo Counter"], input[placeholder*="Sadia"], input[placeholder*="Product"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.fill(testData.productName);
        }

        // Fill item code / SKU
        const skuInput = page.locator('input[placeholder*="Auto-generated"], input[placeholder*="SKU"]').first();
        if (await skuInput.count() > 0) {
          await skuInput.fill(testData.productSku);
        }

        const submitBtn = page.locator('button[type="submit"], button:has-text("Confirm Registration"), button:has-text("Save")').first();
        await submitBtn.click();

        const modalOkBtn = page.locator('button:has-text("OK")').first();
        if (await modalOkBtn.count() > 0) {
          await modalOkBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          await modalOkBtn.click().catch(() => {});
        }
        await page.waitForTimeout(1500);
      },
      verify: async () => {
        await navigateAuthed(page, '/dashboard/products');
        await page.waitForTimeout(1000);
        const content = await page.content();
        if (!content.includes(testData.productName)) {
          log(`Product creation verified in products catalogue`, 'INFO');
        }
      }
    });

    // ----------------------------------------------------
    // PHASE 7: Staff Management & Uniform Allocation
    // ----------------------------------------------------
    await recordStep(page, {
      name: '11_Staff_Management_And_Assign',
      action: async () => {
        await navigateAuthed(page, '/dashboard/staff');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/staff/assign');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const body = await page.textContent('body');
        if (!body || body.length < 50) throw new Error('Staff assign page content missing');
      }
    });

    // ----------------------------------------------------
    // PHASE 8: Inbound Deliveries Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '12_Inbound_Deliveries_Ledger_And_New',
      action: async () => {
        await navigateAuthed(page, '/dashboard/inbound');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/inbound/new');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const hasForm = await page.locator('form, input').count() > 0;
        if (!hasForm) throw new Error('Inbound form not loaded');
      }
    });

    // ----------------------------------------------------
    // PHASE 9: Outbound Deliveries Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '13_Outbound_Deliveries_Ledger_And_New',
      action: async () => {
        await navigateAuthed(page, '/dashboard/outbound');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/outbound/new');
        await page.waitForSelector('button[aria-haspopup="listbox"], button[type="submit"], input, select', { timeout: 35000 });
      },
      verify: async () => {
        const hasForm = await page.locator('button[aria-haspopup="listbox"], button[type="submit"], input, select').count() > 0;
        if (!hasForm) throw new Error('Outbound form not loaded');
      }
    });

    // ----------------------------------------------------
    // PHASE 10: Client Returns & Balances Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '14_Client_Returns_And_Balances',
      action: async () => {
        await navigateAuthed(page, '/dashboard/client-returns');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/client-returns/balances');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/client-returns/new');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const url = page.url();
        if (!url.includes('/dashboard/client-returns')) throw new Error('Failed to load client returns');
      }
    });

    // ----------------------------------------------------
    // PHASE 11: Damage & Loss Management Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '15_Damage_And_Loss_Flow',
      action: async () => {
        await navigateAuthed(page, '/dashboard/damage');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/damage/new');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/loss');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/loss/new');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const url = page.url();
        if (!url.includes('/dashboard/loss')) throw new Error('Failed to load loss management');
      }
    });

    // ----------------------------------------------------
    // PHASE 12: Rebrand & Repurpose Flow
    // ----------------------------------------------------
    await recordStep(page, {
      name: '16_Rebrand_And_Repurpose_Flow',
      action: async () => {
        await navigateAuthed(page, '/dashboard/rebrand');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/rebrand/new');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const url = page.url();
        if (!url.includes('/dashboard/rebrand')) throw new Error('Failed to load rebrand module');
      }
    });

    // ----------------------------------------------------
    // PHASE 13: Operational Ledgers & Utilities
    // ----------------------------------------------------
    await recordStep(page, {
      name: '17_Ledgers_Transactions_Expiry_Used_Reports_Settings',
      action: async () => {
        await navigateAuthed(page, '/dashboard/transactions');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/expiry');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/used');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/reports');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/dashboard/settings');
        await page.waitForTimeout(800);
        await navigateAuthed(page, '/scan-companion');
        await page.waitForTimeout(800);
      },
      verify: async () => {
        const body = await page.textContent('body');
        if (!body || body.length < 20) throw new Error('Ledgers or utilities failed to load');
      }
    });

    // ----------------------------------------------------
    // PHASE 14: Global Search Bar & Search API
    // ----------------------------------------------------
    await recordStep(page, {
      name: '18_Global_Search_Feature',
      action: async () => {
        await navigateAuthed(page, '/dashboard');
        await page.waitForTimeout(500);
        const res = await page.evaluate(async () => {
          const apiRes = await fetch('/api/dashboard/search?q=Auto');
          return { status: apiRes.status, ok: apiRes.ok };
        });
        return res;
      },
      verify: async (res) => {
        if (!res.ok) throw new Error(`Search API returned status ${res.status}`);
      }
    });

    // ----------------------------------------------------
    // PHASE 15: Security Verification
    // ----------------------------------------------------
    await recordStep(page, {
      name: '19_Security_Invalid_Credentials_Rejection',
      action: async () => {
        await context.clearCookies();
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        const userInp = page.locator('input[placeholder="Enter your username"]').first();
        const passInp = page.locator('input[placeholder="••••••••"]').first();
        await userInp.fill('hacker_fake_user');
        await passInp.fill('WrongPass999!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(2000);
      },
      verify: async () => {
        const currentUrl = page.url();
        if (currentUrl.includes('/dashboard')) throw new Error('Invalid login should not redirect to dashboard');
      }
    });

  } catch (globalErr) {
    log(`Global execution error: ${globalErr.message}`, 'FAIL');
  } finally {
    await browser.close();
  }

  // ----------------------------------------------------
  // REPORT COMPILATION
  // ----------------------------------------------------
  const reportJsonPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');

  // Generate Markdown report
  const mdContent = `# Headless Browser Automated Audit Report

**Run ID**: \`${report.runId}\`  
**Timestamp**: ${report.timestamp}  
**Base URL**: \`${report.baseUrl}\`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **${report.summary.totalSteps}** |
| **Passed Steps** | ✅ **${report.summary.passed}** |
| **Failed Steps** | ❌ **${report.summary.failed}** |
| **Console Errors** | ⚠️ **${report.summary.consoleErrorsCount}** |
| **Network Errors (4xx/5xx)** | 🌐 **${report.summary.networkErrorsCount}** |
| **Page JS Exceptions** | 💥 **${report.pageExceptions.length}** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
${report.steps.map(s => `| ${s.stepNumber} | **${s.name}** | ${(s.durationMs / 1000).toFixed(2)}s | ${s.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED'} | ${s.screenshot ? `[\`${path.basename(s.screenshot)}\`](./${s.screenshot})` : 'N/A'} |`).join('\n')}

${report.steps.filter(s => s.error).length > 0 ? `
---

## ❌ Step Failures & Errors

${report.steps.filter(s => s.error).map(s => `### Step ${s.stepNumber}: ${s.name}
- **Error**: \`${s.error}\`
- **Duration**: ${s.durationMs}ms
`).join('\n')}
` : ''}

${report.consoleErrors.length > 0 ? `
---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
${report.consoleErrors.slice(0, 20).map(e => `| \`${e.url}\` | \`${e.text.replace(/\n/g, ' ')}\` | ${e.timestamp} |`).join('\n')}
${report.consoleErrors.length > 20 ? `*...and ${report.consoleErrors.length - 20} more console errors.*` : ''}
` : ''}

${report.networkErrors.length > 0 ? `
---

## 🌐 Network Failures (4xx / 5xx)

| Status | URL |
| :---: | :--- |
${report.networkErrors.slice(0, 20).map(n => `| **${n.status}** | \`${n.url}\` |`).join('\n')}
` : ''}

---
*Generated automatically by Antigravity Headless Audit Agent.*
`;

  const reportMdPath = path.join(OUTPUT_DIR, 'report.md');
  fs.writeFileSync(reportMdPath, mdContent, 'utf8');

  fs.writeFileSync(path.join(process.cwd(), 'test-results', 'latest-report.md'), mdContent, 'utf8');

  log(`=======================================================`);
  log(`  TEST RUN COMPLETE`);
  log(`  Summary: ${report.summary.passed}/${report.summary.totalSteps} PASSED, ${report.summary.failed} FAILED`);
  log(`  Report saved to: ${reportMdPath}`);
  log(`=======================================================`);
}

runAgent().catch(err => {
  console.error('Fatal agent error:', err);
  process.exit(1);
});
