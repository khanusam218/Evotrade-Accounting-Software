-- Migration 074: Add Stock Count Excess account under Other Income (502)
INSERT INTO chart_of_accounts
  (code, name, system_name, account_type, account_group, parent_id, is_active, is_system, normal_balance, is_parent, company_id)
VALUES (
  '502-00001',
  'Stock Count Excess',
  'StockCountExcess',
  'revenue',
  'transactional',
  (SELECT id FROM chart_of_accounts WHERE code = '502' AND company_id = 'evotrade'),
  true,
  false,
  'credit',
  false,
  'evotrade'
)
ON CONFLICT DO NOTHING;
