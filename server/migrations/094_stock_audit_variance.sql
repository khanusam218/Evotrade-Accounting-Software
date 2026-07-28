-- Completing a Stock Audit only flipped its status — the counted quantity
-- never got compared against the system's quantity-on-hand, so no variance
-- was recorded and stock was never actually corrected to match the physical
-- count. These columns capture the system quantity at completion time and
-- the resulting variance, alongside applying it as a real stock adjustment.
ALTER TABLE stock_audit_lines ADD COLUMN IF NOT EXISTS system_qty NUMERIC(18,4);
ALTER TABLE stock_audit_lines ADD COLUMN IF NOT EXISTS variance NUMERIC(18,4);
