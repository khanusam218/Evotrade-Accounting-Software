# Evotrade Accounting Software - Complete Testing Guide

**Purpose:** Comprehensive testing strategy for all functionality and workflows

---

## 1. API TESTING TOOLS

### A. Postman (Desktop App)
**What:** API testing, collections, automation  
**Cost:** Free (with paid Pro tier)  
**How to use:**
```
1. Download Postman: https://www.postman.com/downloads/
2. Create new collection "Evotrade API Tests"
3. Add requests for each endpoint:
   - POST /api/auth/login
   - POST /api/auth/register
   - GET /api/chart-of-accounts
   - POST /api/sales-invoices
   - etc.
4. Add tests with pre-request scripts and assertions
5. Run collection in sequence (with delays between requests)
```

**Sample Test Flow:**
```javascript
// Pre-request script for auth endpoints
pm.environment.set("token", "");

// Test script for login
pm.test("Login returns JWT token", function () {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().token).to.be.a('string');
  pm.environment.set("token", pm.response.json().token);
});

// Pre-request script for protected endpoints
pm.request.headers.add({
  key: "Authorization",
  value: "Bearer " + pm.environment.get("token")
});
```

### B. Thunder Client (VS Code Extension)
**What:** Lightweight API testing in VS Code  
**Cost:** Free  
**Advantage:** Built into your IDE, no separate app needed

### C. REST Client (VS Code Extension)
**What:** Simple HTTP requests in `.http` files  
**Cost:** Free

**Sample `.http` file:**
```http
### Register user
POST http://localhost:3001/api/auth/register HTTP/1.1
Content-Type: application/json

{
  "id": "testuser1",
  "password": "password123",
  "confirmPassword": "password123"
}

### Login
POST http://localhost:3001/api/auth/login HTTP/1.1
Content-Type: application/json

{
  "id": "testuser1",
  "password": "password123"
}

### Get Chart of Accounts (with token from login response)
GET http://localhost:3001/api/chart-of-accounts HTTP/1.1
Authorization: Bearer {token_from_login_response}
```

### D. curl (Command Line)
**What:** Simple command-line API testing  
**Cost:** Free (built-in)

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"id":"test","password":"pass123","confirmPassword":"pass123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"test","password":"pass123"}'

# Access protected endpoint with token
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:3001/api/chart-of-accounts
```

---

## 2. FRONTEND TESTING TOOLS

### A. Manual Browser Testing (Free)
**Tools:** Chrome DevTools, Firefox Developer Tools  
**Steps:**
```
1. Open http://localhost:5173 in browser
2. Test login/signup workflow
3. Verify JWT token stored in localStorage
4. Test navigation between pages
5. Check console for errors (F12 → Console)
6. Check Network tab for API calls (F12 → Network)
7. Test responsive design (F12 → Device toolbar)
```

### B. Playwright (Automated E2E Testing)
**What:** Automated browser testing across Chrome, Firefox, Safari  
**Cost:** Free  
**Install:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Example test file:**
```javascript
// tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('User can register and login', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    
    // Click signup
    await page.click('text=Sign Up');
    
    // Fill signup form
    await page.fill('input[placeholder*="ID"]', 'newuser');
    await page.fill('input[type="password"]:first-of-type', 'password123');
    await page.fill('input[type="password"]:last-of-type', 'password123');
    
    // Submit
    await page.click('button:has-text("Create Account")');
    
    // Verify logged in
    await expect(page).toHaveURL('**/dashboard');
    
    // Logout
    await page.click('text=Logout');
    
    // Verify back at login
    await expect(page).toHaveURL('http://localhost:5173');
  });
});
```

**Run tests:**
```bash
npx playwright test
npx playwright test --headed  # Show browser
npx playwright test --debug   # Debug mode
```

### C. Cypress (E2E Testing)
**What:** Modern E2E testing framework  
**Cost:** Free (cloud features paid)  
**Install:**
```bash
npm install --save-dev cypress
npx cypress open
```

---

## 3. INTEGRATED TESTING WORKFLOW

### Complete Test Checklist

#### Authentication (Critical)
- [ ] Register new user with valid credentials
- [ ] Register fails with existing user ID
- [ ] Register fails with weak password (< 6 chars)
- [ ] Login with correct credentials returns JWT token
- [ ] Login with wrong password fails
- [ ] JWT token stored in localStorage
- [ ] Token sent in Authorization header on API calls
- [ ] API returns 401 without valid token
- [ ] Logout clears token and redirects to login
- [ ] Accessing protected route without token redirects to login

#### Chart of Accounts (Core Feature)
- [ ] Can view full chart of accounts
- [ ] Accounts grouped by type (Assets, Equity, etc.)
- [ ] Can create new account under parent
- [ ] Parent account dropdown shows only control accounts
- [ ] Balance calculations are accurate (no floating-point errors)
- [ ] Can edit account (if permitted)
- [ ] Can deactivate account
- [ ] Hierarchical structure displays correctly

#### Sales Invoices (End-to-End)
- [ ] Create new sales invoice
- [ ] Add line items with amounts
- [ ] Totals calculated correctly (gross, tax, net)
- [ ] Amounts rounded to 2 decimals
- [ ] Can approve invoice
- [ ] Revenue account posting works
- [ ] Balance updates on chart of accounts
- [ ] Can print invoice

#### Rate Limiting & Security
- [ ] Can make 20 auth requests in 15 minutes
- [ ] 21st auth request (in 15 min) returns 429 (Too Many Requests)
- [ ] Can make 200 general API requests in 15 minutes
- [ ] 201st request returns 429
- [ ] CORS headers restrict to localhost:5173
- [ ] Error messages don't leak database details

#### Multi-User Isolation
- [ ] User 1 registers and creates business
- [ ] User 2 registers separately
- [ ] User 1 cannot see User 2's data
- [ ] User 2 cannot see User 1's data
- [ ] Each user has isolated business list

---

## 4. LOAD/STRESS TESTING

### A. Apache JMeter (Free)
**Download:** https://jmeter.apache.org/  
**Purpose:** Test app under load

**Simple test plan:**
```
1. Add Thread Group (10 users, ramp-up 10s, 100 iterations)
2. Add HTTP Request: GET /api/chart-of-accounts (with token)
3. Add Listener: View Results Tree
4. Run test → See if server handles load
```

### B. Artillery (CLI-based)
**Install:**
```bash
npm install -g artillery
```

**Load test file (load-test.yml):**
```yaml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Get Chart of Accounts"
    flow:
      - get:
          url: "/api/chart-of-accounts"
          headers:
            Authorization: "Bearer YOUR_TOKEN"
```

**Run:**
```bash
artillery run load-test.yml
```

---

## 5. DATABASE TESTING

### A. pgAdmin (PostgreSQL GUI)
**Download:** https://www.pgadmin.org/  
**Use for:**
```
- Verify data integrity
- Check RLS policies working
- Verify transactions rolling back on error
- Monitor table sizes
- Check for orphaned records
```

### B. SQL Queries for Verification
```sql
-- Verify users table exists
SELECT * FROM users;

-- Verify RLS is working (should only see current company)
SELECT COUNT(*) FROM chart_of_accounts 
WHERE company_id = 'test-company';

-- Check for floating-point precision issues
SELECT id, code, current_balance 
FROM chart_of_accounts 
WHERE current_balance LIKE '%0000000%' 
   OR current_balance LIKE '%9999999%';

-- Verify transaction integrity
SELECT * FROM sales_invoices 
WHERE status = 'approved' 
AND net_amount != (gross_amount - discount + tax_amount);
```

---

## 6. AUTOMATED TEST SUITE (Recommended Implementation)

### Setup Jest + Supertest (Backend)
```bash
npm install --save-dev jest supertest
```

**test/auth.test.js:**
```javascript
const request = require('supertest');
const app = require('../src/index');

describe('Authentication', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        id: 'testuser',
        password: 'password123',
        confirmPassword: 'password123'
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('should reject duplicate user ID', async () => {
    await request(app).post('/api/auth/register').send({
      id: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    const res = await request(app).post('/api/auth/register').send({
      id: 'testuser',
      password: 'password456',
      confirmPassword: 'password456'
    });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('already exists');
  });

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      id: 'admin',
      password: 'admin'
    });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should reject request without JWT', async () => {
    const res = await request(app).get('/api/chart-of-accounts');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorised');
  });

  it('should accept request with valid JWT', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      id: 'admin',
      password: 'admin'
    });
    
    const token = loginRes.body.token;
    
    const res = await request(app)
      .get('/api/chart-of-accounts')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

**Run tests:**
```bash
npm test
npm test -- --coverage  # See code coverage
npm test -- --watch     # Watch mode
```

---

## 7. RECOMMENDED TESTING WORKFLOW

### Daily Development
```
1. Manual browser testing (5 mins)
   - Test login/logout
   - Create/edit a record
   - Check browser console for errors

2. API testing with Postman (10 mins)
   - Run "Quick Auth Test" collection
   - Test one main workflow (e.g., create invoice)
   - Verify error handling

3. Run test suite locally (2 mins)
   npm test
```

### Before Merging
```
1. Run full test suite with coverage
   npm test -- --coverage
   
2. Run Playwright E2E tests
   npx playwright test

3. Run load test (10 users, 100 iterations)
   artillery run load-test.yml

4. Manual comprehensive testing
   - Complete end-to-end flow
   - Check multi-user isolation
   - Verify financial accuracy
```

### Before Production Deploy
```
1. Full test suite passes
2. Manual testing on staging environment
3. Performance baseline (load test)
4. Security audit (CORS, headers, JWT)
5. Database integrity check
6. Backup and disaster recovery test
```

---

## 8. QUICK START: Test the App Right Now

### Minimal Testing (5 minutes)
```bash
# Terminal 1: Start backend
cd server && npm start

# Terminal 2: Start frontend
cd client && npm run dev

# Terminal 3: Test with curl
# Register
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"id":"quick_test","password":"test123","confirmPassword":"test123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"admin","password":"admin"}'

# Get data with token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/chart-of-accounts | head -c 200
```

### Full Manual Testing (30 minutes)
1. Open http://localhost:5173
2. Test signup → Create account → Create business → Navigate to dashboard
3. Go to Chart of Accounts → Create new account
4. Go to Sales Invoices → Create invoice → Approve invoice
5. Check browser console (F12) for errors
6. Check Network tab to see API calls
7. Logout and verify form is cleared

---

## 9. TOOLS INSTALLATION QUICK REFERENCE

### Frontend Testing Tools
```bash
# Install Playwright
npm install --save-dev @playwright/test
npx playwright install

# Install Cypress
npm install --save-dev cypress
npx cypress open
```

### Backend Testing Tools
```bash
# Install Jest + Supertest
npm install --save-dev jest supertest @types/jest

# Install Artillery
npm install -g artillery

# Install test database (optional, for isolated testing)
npm install --save-dev pg-boss  # Job queue testing
```

### API Testing Tools
- **Postman**: https://www.postman.com/downloads/ (Desktop)
- **REST Client VS Code**: Search "REST Client" in VS Code extensions
- **Thunder Client VS Code**: Search "Thunder Client" in VS Code extensions

---

## 10. CRITICAL PATHS TO TEST

Based on the audit, test these most critical workflows:

### 1. Authentication (Security Critical)
- [ ] Register → creates user with bcrypt hash
- [ ] Login → returns valid JWT
- [ ] Invalid credentials → 401
- [ ] Unauth request → 401
- [ ] Token in header → access granted

### 2. Financial Accuracy (Data Integrity Critical)
- [ ] Create invoice with 0.1 + 0.2 line items → equals 0.3 (not 0.30000000001)
- [ ] Expense with discount percentage → rounded to 2 decimals
- [ ] Tax calculation → accurate

### 3. Multi-User Isolation (Security Critical)
- [ ] User A's data not visible to User B
- [ ] Each user has separate token
- [ ] RLS prevents cross-company access

### 4. Rate Limiting (DoS Protection Critical)
- [ ] 21st auth request in 15min → 429
- [ ] 201st general request in 15min → 429

---

## Summary

| Tool | Purpose | Ease | Coverage |
|------|---------|------|----------|
| Postman | API testing | Easy | All endpoints |
| Browser DevTools | Frontend testing | Easy | UI + Network |
| Playwright | E2E automated | Medium | Full workflows |
| Jest + Supertest | Unit/integration | Medium | Critical paths |
| Artillery | Load testing | Medium | Performance |
| Manual testing | Exploratory | Easy | User perspective |

**Recommendation:** Start with Postman + Manual Browser Testing for quick feedback, then add Playwright E2E tests for regression prevention before each deploy.
