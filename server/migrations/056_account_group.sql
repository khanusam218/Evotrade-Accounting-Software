-- Migration 056: Add account_group to chart_of_accounts
-- 'transactional' = posting account (leaf), 'control' = header/group account

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS account_group VARCHAR(20) NOT NULL DEFAULT 'transactional';

-- Mark existing parent (header) accounts as 'control'
UPDATE chart_of_accounts ca
   SET account_group = 'control'
 WHERE EXISTS (
   SELECT 1 FROM chart_of_accounts child WHERE child.parent_id = ca.id
 );
