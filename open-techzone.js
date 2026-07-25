'use strict';
const { chromium } = require('playwright');

const BIZ_ID   = 'techzone-demo-2024';
const BIZ_NAME = 'TechZone Electronics';
const BIZ_TYPE = 'Wholesale';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page    = await browser.newPage();
  page.setDefaultTimeout(15000);

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // Login
  await page.waitForSelector('input[placeholder="Enter ID"]');
  await page.fill('input[placeholder="Enter ID"]', 'admin');
  await page.fill('input[placeholder="Enter password"]', '123456');
  await page.click('button:has-text("Log In")');
  await page.waitForTimeout(2000);

  // Inject TechZone Electronics into localStorage
  await page.evaluate(({ id, name, type }) => {
    const biz = { id, name, type, color: '#2563eb', initials: 'TE', createdAt: new Date().toISOString(), isNew: false };
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem('evotrade_businesses_admin') || '[]'); } catch {}
    if (!existing.find(b => b.id === id)) existing.push(biz);
    localStorage.setItem('evotrade_businesses_admin', JSON.stringify(existing));
    localStorage.setItem('evotrade_active_business', JSON.stringify(biz));
  }, { id: BIZ_ID, name: BIZ_NAME, type: BIZ_TYPE });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('✅  TechZone Electronics is open. Browser will stay open.');
  // Keep browser open indefinitely
  await new Promise(() => {});
})();
