/**
 * Automated seed runner using Playwright.
 * 1. Logs in as admin
 * 2. Injects "TechZone Electronics" business into localStorage
 * 3. Enters the business
 * 4. Runs the seed-demo-data.js script in the browser
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BIZ_ID   = 'techzone-demo-2024';
const BIZ_NAME = 'TechZone Electronics';
const BIZ_TYPE = 'Wholesale';

(async () => {
  // Read seed file — the top-level IIFE is already self-executing
  const seedCode = fs.readFileSync(path.join(__dirname, 'seed-demo-data.js'), 'utf8');

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page    = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Forward browser console → Node stdout
  page.on('console', msg => {
    const t = msg.text();
    if (!t.startsWith('[vite]') && !t.startsWith('[HMR]')) {
      process.stdout.write((msg.type() === 'error' ? '❌  ' : '') + t + '\n');
    }
  });

  // ── 1. Open app ─────────────────────────────────────────────────────────────
  console.log('🌐  Opening app at http://localhost:5173…');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // ── 2. Login ────────────────────────────────────────────────────────────────
  console.log('🔐  Logging in as admin / 123456…');
  await page.waitForSelector('input[placeholder="Enter ID"]', { timeout: 15000 });
  await page.fill('input[placeholder="Enter ID"]', 'admin');
  await page.fill('input[placeholder="Enter password"]', '123456');
  await page.click('button:has-text("Log In")');
  await page.waitForTimeout(2500);

  // ── 3. Inject business into localStorage ────────────────────────────────────
  console.log('💉  Injecting TechZone Electronics business into localStorage…');
  await page.evaluate(({ id, name, type }) => {
    const KEY_BIZ    = `evotrade_businesses_admin`;
    const KEY_ACTIVE = 'evotrade_active_business';

    const biz = {
      id,
      name,
      type,
      color:     '#2563eb',
      initials:  'TE',
      createdAt: new Date().toISOString(),
      isNew:     false,
    };

    // Merge with any existing businesses (don't overwrite user's real businesses)
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(KEY_BIZ) || '[]'); } catch {}
    const already = existing.find(b => b.id === id);
    if (!already) existing.push(biz);
    localStorage.setItem(KEY_BIZ, JSON.stringify(existing));
    localStorage.setItem(KEY_ACTIVE, JSON.stringify(biz));
  }, { id: BIZ_ID, name: BIZ_NAME, type: BIZ_TYPE });

  // ── 4. Reload — app will see the active business and go to main layout ───────
  console.log('🔄  Reloading to enter business…');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Verify we are inside the app (not on the business-select screen)
  const activeBiz = await page.evaluate(() => localStorage.getItem('evotrade_active_business'));
  const biz = JSON.parse(activeBiz || '{}');
  if (!biz.id) {
    console.error('❌  Active business not set. Aborting.');
    await page.screenshot({ path: 'seed-debug.png' });
    await browser.close();
    process.exit(1);
  }
  console.log(`✅  Active business: "${biz.name}" (company ID: ${biz.id})\n`);

  // Make sure we are on a main-app page (click into business if still on selector)
  const url = page.url();
  if (url.includes('localhost:5173') && !url.includes('/setup')) {
    // If still on business selector, click the card
    try {
      const card = page.locator(`text="${BIZ_NAME}"`).first();
      const visible = await card.isVisible({ timeout: 3000 }).catch(() => false);
      if (visible) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    } catch { /* already inside app */ }
  }

  // ── 5. Run seed ──────────────────────────────────────────────────────────────
  console.log('🚀  Running seed script… (takes 2-3 minutes — watch below)\n');
  console.log('─'.repeat(60));

  try {
    // The seed file is already an IIFE: (async function seedTechZone() { ... })()
    // new Function('return ' + code)() evaluates it and returns the Promise
    await page.evaluate(async (code) => {
      // eslint-disable-next-line no-new-func
      await (new Function('return ' + code)());
    }, seedCode);
  } catch (err) {
    console.error('\n❌  Seed error:', err.message);
    await page.screenshot({ path: 'seed-error.png' });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('✅  Seed finished. Refreshing app…');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'seed-complete.png', fullPage: false });
  console.log('📸  Screenshot saved: seed-complete.png');
  console.log('\nThe browser will stay open so you can explore the seeded data.');
  console.log('Close it manually when done.\n');

  // Keep browser open for viewing
  await page.waitForTimeout(60000 * 5); // stay open 5 min
  await browser.close();
})();
