-- ============================================================
-- Migration 067: Normalise chart-of-accounts group headers for
-- every company (runs as superuser, so RLS is bypassed).
--   1. Remove the orphaned SP-* sub-group duplicates left by an
--      earlier seed/rename loop (only childless ones).
--   2. Ensure the 15 numeric sub-groups are active group (control)
--      headers — migration 057 demotes childless 'control' rows to
--      'transactional', which would hide empty groups (Bank,
--      Depreciation, ...) from the Parent Account dropdown. This
--      migration runs after 057, so it restores them every startup.
-- Idempotent.
-- ============================================================

-- Step 1: Drop the leftover SP-* sub-group duplicates (keep the five
-- top-level type headers SP-ASSETS / SP-EQUITY / ...). Only rows with
-- no children are removed, so nothing referenced is touched.
DELETE FROM chart_of_accounts
 WHERE code IN ('SP-CUR-ASSET','SP-CASH','SP-BANK','SP-INVENTORY','SP-NONCUR-AST',
                'SP-FIXED-AST','SP-EQUITY-SUB','SP-DIRECT-CST','SP-DEPRECIATN',
                'SP-EXPENSE','SP-OTHER-EXP','SP-CUR-LIAB','SP-LT-LIAB',
                'SP-REVENUE-SUB','SP-OTHER-INC')
   AND NOT EXISTS (
     SELECT 1 FROM chart_of_accounts c WHERE c.parent_id = chart_of_accounts.id
   );

-- Step 2: Make the numeric sub-groups active group headers.
UPDATE chart_of_accounts
   SET is_active = true, account_group = 'control', is_parent = true
 WHERE code IN ('110','111','112','113','120','121','201',
                '301','302','303','304','401','402','501','502');
