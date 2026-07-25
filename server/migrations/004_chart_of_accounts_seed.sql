-- ============================================================
-- Migration 004: Chart of Accounts – seed system accounts
-- Table already created in 001_customers.sql
-- ============================================================

-- Helper: insert only if code doesn't exist
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, parent_id, is_system, normal_balance, description)
VALUES
  -- ── ASSETS ───────────────────────────────────────────────────────────────
  ('100', 'Assets', 'assets', 'asset', NULL, true, 'debit', 'All asset accounts'),
  ('101', 'Current Assets', 'current_assets', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), true, 'debit', 'Short-term assets'),
  ('101-0001', 'Cash on Hand', 'cash_on_hand', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='101'), true, 'debit', NULL),
  ('101-0002', 'Petty Cash', NULL, 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='101'), false, 'debit', NULL),
  ('101-0003', 'Undeposited Funds', 'undeposited_funds', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='101'), true, 'debit', NULL),
  ('102', 'Bank Accounts', 'bank_accounts', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), true, 'debit', NULL),
  ('103', 'Accounts Receivable', 'accounts_receivable', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), true, 'debit', 'Money owed by customers'),
  ('104', 'Inventory', 'inventory', 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), true, 'debit', 'Stock on hand'),
  ('105', 'Prepaid Expenses', NULL, 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), false, 'debit', NULL),
  ('110', 'Fixed Assets', NULL, 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='100'), false, 'debit', 'Long-term assets'),
  ('110-0001', 'Property & Equipment', NULL, 'asset',
    (SELECT id FROM chart_of_accounts WHERE code='110'), false, 'debit', NULL),
  ('110-0002', 'Accumulated Depreciation', NULL, 'contra_asset',
    (SELECT id FROM chart_of_accounts WHERE code='110'), false, 'credit', NULL),

  -- ── LIABILITIES ──────────────────────────────────────────────────────────
  ('200', 'Liabilities', 'liabilities', 'liability', NULL, true, 'credit', 'All liability accounts'),
  ('201', 'Current Liabilities', 'current_liabilities', 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='200'), true, 'credit', NULL),
  ('201-0001', 'Accounts Payable', 'accounts_payable', 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='201'), true, 'credit', 'Money owed to vendors'),
  ('201-0002', 'Tax Payable', 'tax_payable', 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='201'), true, 'credit', 'Sales tax collected'),
  ('201-0003', 'Withholding Tax Payable', NULL, 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='201'), false, 'credit', NULL),
  ('201-0004', 'Accrued Expenses', NULL, 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='201'), false, 'credit', NULL),
  ('201-0005', 'Unearned Revenue', NULL, 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='201'), false, 'credit', NULL),
  ('202', 'Long-term Liabilities', NULL, 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='200'), false, 'credit', NULL),
  ('202-0001', 'Long-term Loans', NULL, 'liability',
    (SELECT id FROM chart_of_accounts WHERE code='202'), false, 'credit', NULL),

  -- ── EQUITY ───────────────────────────────────────────────────────────────
  ('300', 'Equity', 'equity', 'equity', NULL, true, 'credit', 'Owner equity accounts'),
  ('301-0001', 'Owner''s Capital', 'owners_capital', 'equity',
    (SELECT id FROM chart_of_accounts WHERE code='300'), true, 'credit', NULL),
  ('302-0001', 'Retained Earnings', 'retained_earnings', 'equity',
    (SELECT id FROM chart_of_accounts WHERE code='300'), true, 'credit', NULL),
  ('303-0001', 'Current Year Earnings', 'current_year_earnings', 'equity',
    (SELECT id FROM chart_of_accounts WHERE code='300'), true, 'credit', NULL),

  -- ── REVENUE ──────────────────────────────────────────────────────────────
  ('400', 'Revenue', 'revenue', 'revenue', NULL, true, 'credit', 'All income accounts'),
  ('401-0001', 'Sales Revenue', 'sales_revenue', 'revenue',
    (SELECT id FROM chart_of_accounts WHERE code='400'), true, 'credit', NULL),
  ('401-0002', 'Sales Returns & Allowances', 'sales_returns', 'contra_revenue',
    (SELECT id FROM chart_of_accounts WHERE code='400'), true, 'debit', NULL),
  ('402-0001', 'Service Revenue', NULL, 'revenue',
    (SELECT id FROM chart_of_accounts WHERE code='400'), false, 'credit', NULL),
  ('403-0001', 'Other Income', NULL, 'revenue',
    (SELECT id FROM chart_of_accounts WHERE code='400'), false, 'credit', NULL),
  ('403-0002', 'Discount Received', 'discount_received', 'revenue',
    (SELECT id FROM chart_of_accounts WHERE code='400'), true, 'credit', NULL),

  -- ── EXPENSES ─────────────────────────────────────────────────────────────
  ('500', 'Expenses', 'expenses', 'expense', NULL, true, 'debit', 'All expense accounts'),
  ('501-0001', 'Cost of Goods Sold', 'cogs', 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), true, 'debit', 'Direct cost of products sold'),
  ('502-0001', 'Salary & Wages', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL),
  ('503-0001', 'Rent Expense', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL),
  ('504-0001', 'Utilities Expense', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL),
  ('505-0001', 'Marketing & Advertising', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL),
  ('506-0001', 'Bank Charges', 'bank_charges', 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), true, 'debit', NULL),
  ('507-0001', 'Depreciation Expense', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL),
  ('508-0001', 'Discount Allowed', 'discount_allowed', 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), true, 'debit', NULL),
  ('509-0001', 'General & Administrative', NULL, 'expense',
    (SELECT id FROM chart_of_accounts WHERE code='500'), false, 'debit', NULL)

ON CONFLICT DO NOTHING;
