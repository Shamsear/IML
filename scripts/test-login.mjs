import { chromium } from 'playwright';

async function testLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/api/auth')) {
      console.log('AUTH RESPONSE:', res.url(), res.status());
      try {
        const text = await res.text();
        console.log('AUTH BODY:', text.slice(0, 300));
      } catch (e) {}
    }
  });

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  console.log('Filling form...');
  const usernameInput = page.locator('input[placeholder="Enter your username"]').first();
  await usernameInput.click();
  await usernameInput.fill('test_admin');
  
  const passwordInput = page.locator('input[placeholder="••••••••"]').first();
  await passwordInput.click();
  await passwordInput.fill('TestAdmin@1234');
  
  console.log('Submitting...');
  await page.locator('button[type="submit"]').first().click();
  
  console.log('Waiting for URL to become /dashboard...');
  await page.waitForURL('**/dashboard', { timeout: 45000 });
  console.log('URL after wait:', page.url());
  
  await browser.close();
}

testLogin().catch(console.error);
