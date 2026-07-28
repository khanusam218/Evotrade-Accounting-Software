-- Receive Payments (sales side) allocate to specific Sales Invoices via
-- rp_allocations, reducing each invoice's balance on approve/cancel. Make
-- Payments (purchase side) had no equivalent — a vendor payment never
-- reduced a specific Purchase Invoice's balance/status; only Purchase
-- Settlements did that.
CREATE TABLE IF NOT EXISTS mp_allocations (
  id         SERIAL PRIMARY KEY,
  payment_id INTEGER       NOT NULL REFERENCES make_payments(id) ON DELETE CASCADE,
  invoice_id INTEGER       NOT NULL REFERENCES purchase_invoices(id),
  amount     NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mp_allocations_payment ON mp_allocations(payment_id);

ALTER TABLE mp_allocations ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id();

SELECT setup_company_rls('mp_allocations');
