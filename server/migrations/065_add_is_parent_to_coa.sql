-- ============================================================
-- Migration 065: Add is_parent column to chart_of_accounts
-- ============================================================

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT false;

-- Populate is_parent based on whether account has children
UPDATE chart_of_accounts coa
  SET is_parent = EXISTS (
    SELECT 1 FROM chart_of_accounts child
    WHERE child.parent_id = coa.id
  );
