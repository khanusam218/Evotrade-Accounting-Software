# Playwright Setup & Quick Start

## ✅ Installation Status
- Playwright package: **Installed** ✓
- Browsers (Chromium, Firefox, WebKit): **Installed** ✓
- Sample tests: **Created** (`client/tests/auth.spec.ts`)

---

## Running Tests

### 1. Run All Tests
```bash
cd "C:\Users\PMLS\OneDrive\Evotrade Accounting Software\client"
npx playwright test
```

### 2. Run Tests with Browser Visible
```bash
npx playwright test --headed
```
Shows the browser window so you can watch the tests execute.

### 3. Run Tests in Debug Mode
```bash
npx playwright test --debug
```
Step through each action in the Playwright Inspector.

### 4. Run Single Test File
```bash
npx playwright test tests/auth.spec.ts
```

### 5. Run Tests with UI Mode (Best for Development)
```bash
npx playwright test --ui
```
Opens an interactive UI showing test progress, console logs, and allows re-running tests.

### 6. View Test Report
```bash
npx playwright show-report
```

---

## Before Running Tests

Make sure both servers are running:

```bash
# Terminal 1: Start Backend API
cd server && npm start

# Terminal 2: Start Frontend Dev Server  
cd client && npm run dev

# Terminal 3: Run Playwright Tests
cd client && npx playwright test --headed
```

---

## What the Sample Tests Check

✅ **auth.spec.ts** includes tests for:

1. **User Registration**
   - Register with new credentials
   - Reject duplicate user IDs
   - Password validation

2. **User Login**
   - Login with admin credentials (admin/admin)
   - Reject invalid credentials
   - JWT token stored in localStorage

3. **Form Clearing**
   - Login form fields cleared after logout
   - No cached credentials

4. **Token Security**
   - Protected endpoints require valid JWT
   - 401 error without token
   - 200 response with token

5. **Chart of Accounts**
   - View accounts
   - Accounts display correctly

---

## Expected Test Results

When you run `npx playwright test --headed`, you should see:

```
Evotrade Authentication Workflow
  ✓ User can register with new credentials (5s)
  ✓ User cannot register with duplicate ID (8s)
  ✓ User can login with admin credentials (4s)
  ✓ Invalid login credentials are rejected (3s)
  ✓ Form fields are cleared after logout (6s)
  ✓ JWT token is stored in localStorage after login (4s)
  ✓ Protected API endpoints require valid token (3s)

Chart of Accounts Workflow
  ✓ User can view Chart of Accounts (4s)

─────────────────────────────────────
  8 passed (50s)
```

---

## Test File Location

- **Test file**: `C:\Users\PMLS\OneDrive\Evotrade Accounting Software\client\tests\auth.spec.ts`
- **Edit tests** to match your actual UI selectors if buttons/inputs are named differently

---

## Customizing Tests

Edit `client/tests/auth.spec.ts` to:

1. **Change login credentials:**
   ```typescript
   await page.fill('input[placeholder*="ID"]', 'testuser');  // Change this
   await page.fill('input[type="password"]', 'password123');   // Change this
   ```

2. **Wait for specific elements:**
   ```typescript
   await page.waitForSelector('button:has-text("Create Account")');
   ```

3. **Check for specific text:**
   ```typescript
   await expect(page.locator('text=Your Error Message')).toBeVisible();
   ```

4. **Add more workflows:**
   ```typescript
   test('Create and approve invoice', async ({ page }) => {
     // Test steps here
   });
   ```

---

## Common Commands Reference

```bash
# Interactive UI mode (best for learning)
npx playwright test --ui

# Watch mode (re-run on file changes)
npx playwright test --watch

# Debug specific test
npx playwright test tests/auth.spec.ts --debug

# Show last test report
npx playwright show-report

# Generate test report (HTML)
npx playwright test --reporter=html

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

---

## Next Steps

1. **Start both servers** (backend on 3001, frontend on 5173)
2. **Run tests with UI**: `npx playwright test --ui`
3. **Watch tests execute** in the browser
4. **Create more tests** for other workflows (invoices, customers, etc.)
5. **Add to CI/CD** pipeline for automated testing on every commit

---

## Documentation

- Full Playwright docs: https://playwright.dev/
- Selectors guide: https://playwright.dev/docs/locators
- Assertions reference: https://playwright.dev/docs/test-assertions

---

## Troubleshooting

**Tests can't find elements?**
- Run with `--headed` to see what the page actually looks like
- Open DevTools in the browser and inspect the elements
- Update selectors in the test file to match your actual HTML

**Tests timeout?**
- Make sure both servers are running
- Check browser console for errors
- Increase timeout: `await page.waitForSelector('...', { timeout: 10000 })`

**Browser window doesn't appear?**
- Use `--headed` flag to see browser
- Use `--ui` for interactive mode with full control
