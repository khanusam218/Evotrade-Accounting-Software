-- Migration 057: Fix chart_of_accounts parent_id hierarchy
-- The original seed (004) used self-referencing subqueries in a single INSERT
-- which returned NULL in PostgreSQL (rows not yet visible to the same statement).
-- This migration sets the correct parent_id relationships based on known codes.

-- Assets sub-groups → 100
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '100')
 WHERE code IN ('101','102','103','104','105','110') AND parent_id IS NULL;

-- Current Assets leaves → 101
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '101')
 WHERE code IN ('101-0001','101-0002','101-0003') AND parent_id IS NULL;

-- Fixed Assets leaves → 110
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '110')
 WHERE code IN ('110-0001','110-0002') AND parent_id IS NULL;

-- Liability sub-groups → 200
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '200')
 WHERE code IN ('201','202') AND parent_id IS NULL;

-- Current Liability leaves → 201
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '201')
 WHERE code IN ('201-0001','201-0002','201-0003','201-0004','201-0005') AND parent_id IS NULL;

-- Long-term Liability leaves → 202
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '202')
 WHERE code = '202-0001' AND parent_id IS NULL;

-- Equity leaves → 300
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '300')
 WHERE code IN ('301-0001','302-0001','303-0001') AND parent_id IS NULL;

-- Revenue leaves → 400
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '400')
 WHERE code IN ('401-0001','401-0002','402-0001','403-0001','403-0002') AND parent_id IS NULL;

-- Expense leaves → 500
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '500')
 WHERE code IN ('501-0001','502-0001','503-0001','504-0001','505-0001',
                '506-0001','507-0001','508-0001','509-0001') AND parent_id IS NULL;

-- Re-run account_group: mark all parent accounts as 'control'
UPDATE chart_of_accounts ca
   SET account_group = 'control'
 WHERE EXISTS (SELECT 1 FROM chart_of_accounts c WHERE c.parent_id = ca.id);

-- Mark true leaf accounts as 'transactional' (accounts with no children)
UPDATE chart_of_accounts ca
   SET account_group = 'transactional'
 WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts c WHERE c.parent_id = ca.id)
   AND ca.account_group = 'control';
