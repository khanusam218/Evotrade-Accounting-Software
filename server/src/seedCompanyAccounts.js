// Seeds the standard (Splendid-style) chart of accounts for the CURRENT company.
// Relies on RLS: company_id defaults to current_company_id() and subqueries are
// scoped to the active company, so this seeds whichever business is in context.
// Idempotent — ON CONFLICT DO NOTHING makes it safe to call repeatedly.
//
// Group/parent accounts use Splendid's numeric codes (110, 111, ... 502) so they
// read cleanly in the Parent Account dropdown. The five top-level type headers
// keep SP-* codes (they are never selectable as parents).

const SEED_SQL = `
-- Top-level parent groups (type headers — not selectable as parents)
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('SP-ASSETS',    'Assets',      NULL, 'asset',     'control', NULL, true, true, 'debit',  true),
  ('SP-EQUITY',    'Equity',      NULL, 'equity',    'control', NULL, true, true, 'credit', true),
  ('SP-EXPENSES',  'Expenses',    NULL, 'expense',   'control', NULL, true, true, 'debit',  true),
  ('SP-LIABILITY', 'Liabilities', NULL, 'liability', 'control', NULL, true, true, 'credit', true),
  ('SP-REVENUE',   'Revenue',     NULL, 'revenue',   'control', NULL, true, true, 'credit', true)
ON CONFLICT DO NOTHING;

-- Sub-group headers (the selectable Parent Accounts)
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('110', 'Current Assets',     NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('111', 'Cash',               NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('112', 'Bank',               NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('113', 'Inventory',          NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('120', 'Non Current Assets', NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('121', 'Fixed Assets',       NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS'), true, true, 'debit', true),
  ('201', 'Equity',             NULL, 'equity', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EQUITY'), true, true, 'credit', true),
  ('301', 'Direct Costs',       NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES'), true, true, 'debit', true),
  ('302', 'Depreciation',       NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES'), true, true, 'debit', true),
  ('303', 'Expense',            NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES'), true, true, 'debit', true),
  ('304', 'Other Expense',      NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES'), true, true, 'debit', true),
  ('401', 'Current Liability',   NULL, 'liability', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-LIABILITY'), true, true, 'credit', true),
  ('402', 'Long Term Liability', NULL, 'liability', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-LIABILITY'), true, true, 'credit', true),
  ('501', 'Revenue',            NULL, 'revenue', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-REVENUE'), true, true, 'credit', true),
  ('502', 'Other Income',       NULL, 'revenue', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-REVENUE'), true, true, 'credit', true)
ON CONFLICT DO NOTHING;

-- Asset leaves
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('110-00011', 'Accounts Receivable', 'AccountsReceivable', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110'), true, false, 'debit', false),
  ('110-00012', 'Undeposited Funds', 'UndepositedFunds', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110'), true, false, 'debit', false),
  ('110-00013', 'Prepayments', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110'), true, false, 'debit', false),
  ('110-00014', 'Prepaid Sales Tax', 'DefaultTaxOut', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110'), true, false, 'debit', false),
  ('110-00015', 'WHT on Purchase', 'DefaultWHTTaxOut', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110'), true, false, 'debit', false),
  ('111-00003', 'Cash In Hand', 'Cash', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='111'), true, false, 'debit', false),
  ('113-00003', 'Inventory', 'DefaultInventory', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='113'), true, false, 'debit', false),
  ('120-00003', 'Loan', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='120'), true, false, 'debit', false),
  ('121-00009', 'Computer Equipment', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121'), true, false, 'debit', false),
  ('121-00010', 'Less Accumulated Depreciation on Computer Equipment', NULL, 'contra_asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121'), true, false, 'credit', false),
  ('121-00011', 'Less Accumulated Depreciation on Office Equipment', NULL, 'contra_asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121'), true, false, 'credit', false),
  ('121-00012', 'Office Equipment', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121'), true, false, 'debit', false)
ON CONFLICT DO NOTHING;

-- Equity leaves
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('201-00009', 'Current Earnings', 'CurrentEarnings', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201'), true, false, 'credit', false),
  ('201-00010', 'Retained Earnings', 'RetainedEarnings', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201'), true, false, 'credit', false),
  ('201-00011', 'Owner''s Share Capital', NULL, 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201'), true, false, 'credit', false),
  ('201-00012', 'Opening Balance Equity', 'OpeningBalanceEquity', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201'), true, false, 'credit', false)
ON CONFLICT DO NOTHING;

-- Direct Costs
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('301-00003', 'Cost of Goods Sold', 'DefaultCostOfGoodsSold', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='301'), true, false, 'debit', false)
ON CONFLICT DO NOTHING;

-- Expense leaves
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('303-00061', 'Bank Revaluations', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00062', 'Exchange Gain or Loss', 'ExchangeGainOrLoss', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00063', 'Advertising', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00064', 'Bank Fees', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00065', 'Cleaning', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00066', 'Consulting & Accounting', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00067', 'Depreciation', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00068', 'Entertainment', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00069', 'Freight & Courier', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00070', 'General Expenses', 'DefaultExpense', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00071', 'Discounts Given', 'DiscountsGiven', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00072', 'Discounts Received', 'DiscountsTaken', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00073', 'Income Tax Expense', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00074', 'Insurance', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00075', 'Legal expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00076', 'Light, Power, Heating', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00077', 'Motor Vehicle Expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00078', 'Office Expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00079', 'Printing & Stationery', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00080', 'Rent', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00081', 'Repairs and Maintenance', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00082', 'Subscriptions', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00083', 'Provident Fund', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00084', 'Telephone & Internet', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00085', 'Travel - International', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00086', 'Travel - National', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00087', 'Wages and Salaries', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00088', 'Rounding', 'Rounding', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00089', 'Shipping Charges', 'ShippingCharges', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false),
  ('303-00090', 'Cash Short / Excess', 'CashShortOrExcess', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303'), true, false, 'debit', false)
ON CONFLICT DO NOTHING;

-- Current Liability leaves
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('401-00029', 'Accounts Payable', 'AccountsPayable', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00030', 'Shipping Payable', 'ShippingPayable', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00031', 'Historical Adjustment', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00032', 'Sales Tax', 'DefaultTaxIn', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00033', 'Tracking Transfers', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00034', 'Unpaid Expense Claims', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00035', 'Wages Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00036', 'Employee Tax Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00037', 'Income Tax Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00038', 'Owner A Drawings', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00039', 'Owner A Funds Introduced', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00040', 'Provident Fund Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00041', 'Suspense', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false),
  ('401-00042', 'WHT on Sales', 'DefaultWHTTaxIn', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401'), true, false, 'credit', false)
ON CONFLICT DO NOTHING;

-- Revenue leaves
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent)
VALUES
  ('501-00007', 'Other Revenue', NULL, 'revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501'), true, false, 'credit', false),
  ('501-00008', 'Sales', 'DefaultSales', 'revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501'), true, false, 'credit', false),
  ('501-00009', 'Sales Return', 'SalesReturn', 'contra_revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501'), true, false, 'debit', false)
ON CONFLICT DO NOTHING;
`;

// Inserts the standard chart of accounts for the company currently in context.
// pool.query wraps this in one transaction with the company RLS role applied,
// so company_id defaults to the active company and the parent_id subqueries are
// scoped to it. Statements run sequentially, so each sees the prior inserts.
async function seedCompanyAccounts(pool) {
  await pool.query(SEED_SQL);
}

module.exports = seedCompanyAccounts;
