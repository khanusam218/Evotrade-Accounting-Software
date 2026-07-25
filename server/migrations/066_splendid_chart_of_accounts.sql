-- ============================================================
-- Migration 066: Seed the Splendid-style chart of accounts for
-- the 'evotrade' company (the default/baseline books).
--   * Group headers use Splendid's numeric codes (110 .. 502) so
--     they read cleanly as selectable Parent Accounts.
--   * The original seed accounts are renamed/deactivated so they
--     disappear from the view while keeping FK integrity intact.
-- Idempotent: safe to re-run on every startup.
-- ============================================================

-- Step 1: Free the numeric codes 110 / 201, which the original seed
-- used for "Fixed Assets" / "Current Liabilities". Match by name so a
-- re-run (where 110/201 are now the new sub-groups) is a no-op.
UPDATE chart_of_accounts SET code = 'OLD-110'
 WHERE company_id = 'evotrade' AND code = '110' AND name = 'Fixed Assets';
UPDATE chart_of_accounts SET code = 'OLD-201'
 WHERE company_id = 'evotrade' AND code = '201' AND name = 'Current Liabilities';

-- Step 2: Deactivate the original Evotrade seed accounts.
UPDATE chart_of_accounts
   SET is_active = false
 WHERE company_id = 'evotrade'
   AND code IN (
     '100','101','101-0001','101-0002','101-0003','102','103','104','105',
     'OLD-110','110-0001','110-0002',
     '200','OLD-201','201-0001','201-0002','201-0003','201-0004','201-0005','202','202-0001',
     '300','301-0001','302-0001','303-0001',
     '400','401-0001','401-0002','402-0001','403-0001','403-0002',
     '500','501-0001','502-0001','503-0001','504-0001','505-0001','506-0001',
     '507-0001','508-0001','509-0001',
     'pk23','pk23habb'
   );

-- Step 3: Top-level parent groups (type headers — not selectable as parents)
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent, company_id)
VALUES
  ('SP-ASSETS',    'Assets',      NULL, 'asset',     'control', NULL, true, true, 'debit',  true, 'evotrade'),
  ('SP-EQUITY',    'Equity',      NULL, 'equity',    'control', NULL, true, true, 'credit', true, 'evotrade'),
  ('SP-EXPENSES',  'Expenses',    NULL, 'expense',   'control', NULL, true, true, 'debit',  true, 'evotrade'),
  ('SP-LIABILITY', 'Liabilities', NULL, 'liability', 'control', NULL, true, true, 'credit', true, 'evotrade'),
  ('SP-REVENUE',   'Revenue',     NULL, 'revenue',   'control', NULL, true, true, 'credit', true, 'evotrade')
ON CONFLICT DO NOTHING;

-- Step 4: Sub-group headers (selectable Parent Accounts), numeric codes
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent, company_id)
VALUES
  ('110', 'Current Assets',     NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('111', 'Cash',               NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('112', 'Bank',               NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('113', 'Inventory',          NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('120', 'Non Current Assets', NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('121', 'Fixed Assets',       NULL, 'asset', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-ASSETS' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('201', 'Equity',             NULL, 'equity', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EQUITY' AND company_id='evotrade'), true, true, 'credit', true, 'evotrade'),
  ('301', 'Direct Costs',       NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('302', 'Depreciation',       NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('303', 'Expense',            NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('304', 'Other Expense',      NULL, 'expense', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-EXPENSES' AND company_id='evotrade'), true, true, 'debit', true, 'evotrade'),
  ('401', 'Current Liability',   NULL, 'liability', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-LIABILITY' AND company_id='evotrade'), true, true, 'credit', true, 'evotrade'),
  ('402', 'Long Term Liability', NULL, 'liability', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-LIABILITY' AND company_id='evotrade'), true, true, 'credit', true, 'evotrade'),
  ('501', 'Revenue',            NULL, 'revenue', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-REVENUE' AND company_id='evotrade'), true, true, 'credit', true, 'evotrade'),
  ('502', 'Other Income',       NULL, 'revenue', 'control', (SELECT id FROM chart_of_accounts WHERE code='SP-REVENUE' AND company_id='evotrade'), true, true, 'credit', true, 'evotrade')
ON CONFLICT DO NOTHING;

-- Step 5: Leaf accounts
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent, company_id)
VALUES
  ('110-00011', 'Accounts Receivable', 'AccountsReceivable', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('110-00012', 'Undeposited Funds', 'UndepositedFunds', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('110-00013', 'Prepayments', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('110-00014', 'Prepaid Sales Tax', 'DefaultTaxOut', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('110-00015', 'WHT on Purchase', 'DefaultWHTTaxOut', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='110' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('111-00003', 'Cash In Hand', 'Cash', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='111' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('113-00003', 'Inventory', 'DefaultInventory', 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='113' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('120-00003', 'Loan', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='120' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('121-00009', 'Computer Equipment', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('121-00010', 'Less Accumulated Depreciation on Computer Equipment', NULL, 'contra_asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('121-00011', 'Less Accumulated Depreciation on Office Equipment', NULL, 'contra_asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('121-00012', 'Office Equipment', NULL, 'asset', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='121' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('201-00009', 'Current Earnings', 'CurrentEarnings', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('201-00010', 'Retained Earnings', 'RetainedEarnings', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('201-00011', 'Owner''s Share Capital', NULL, 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('201-00012', 'Opening Balance Equity', 'OpeningBalanceEquity', 'equity', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='201' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('301-00003', 'Cost of Goods Sold', 'DefaultCostOfGoodsSold', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='301' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00061', 'Bank Revaluations', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00062', 'Exchange Gain or Loss', 'ExchangeGainOrLoss', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00063', 'Advertising', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00064', 'Bank Fees', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00065', 'Cleaning', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00066', 'Consulting & Accounting', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00067', 'Depreciation', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00068', 'Entertainment', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00069', 'Freight & Courier', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00070', 'General Expenses', 'DefaultExpense', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00071', 'Discounts Given', 'DiscountsGiven', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00072', 'Discounts Received', 'DiscountsTaken', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00073', 'Income Tax Expense', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00074', 'Insurance', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00075', 'Legal expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00076', 'Light, Power, Heating', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00077', 'Motor Vehicle Expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00078', 'Office Expenses', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00079', 'Printing & Stationery', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00080', 'Rent', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00081', 'Repairs and Maintenance', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00082', 'Subscriptions', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00083', 'Provident Fund', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00084', 'Telephone & Internet', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00085', 'Travel - International', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00086', 'Travel - National', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00087', 'Wages and Salaries', NULL, 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00088', 'Rounding', 'Rounding', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00089', 'Shipping Charges', 'ShippingCharges', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('303-00090', 'Cash Short / Excess', 'CashShortOrExcess', 'expense', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='303' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade'),
  ('401-00029', 'Accounts Payable', 'AccountsPayable', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00030', 'Shipping Payable', 'ShippingPayable', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00031', 'Historical Adjustment', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00032', 'Sales Tax', 'DefaultTaxIn', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00033', 'Tracking Transfers', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00034', 'Unpaid Expense Claims', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00035', 'Wages Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00036', 'Employee Tax Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00037', 'Income Tax Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00038', 'Owner A Drawings', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00039', 'Owner A Funds Introduced', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00040', 'Provident Fund Payable', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00041', 'Suspense', NULL, 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('401-00042', 'WHT on Sales', 'DefaultWHTTaxIn', 'liability', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='401' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('501-00007', 'Other Revenue', NULL, 'revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('501-00008', 'Sales', 'DefaultSales', 'revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501' AND company_id='evotrade'), true, false, 'credit', false, 'evotrade'),
  ('501-00009', 'Sales Return', 'SalesReturn', 'contra_revenue', 'transactional', (SELECT id FROM chart_of_accounts WHERE code='501' AND company_id='evotrade'), true, false, 'debit', false, 'evotrade')
ON CONFLICT DO NOTHING;
