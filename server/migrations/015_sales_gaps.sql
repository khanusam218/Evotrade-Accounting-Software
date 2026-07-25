-- ============================================================
-- Migration 015: Sales Gap Fixes
--   • Tax columns on sales line tables + header totals
--   • sale_tax_id on products for auto-population
--   • sales_invoice_id FK on credit_note_allocations
--   • Shipped status support (no schema change needed, just workflow)
-- ============================================================

-- Tax on sales quotation lines
ALTER TABLE sales_quotation_lines
  ADD COLUMN IF NOT EXISTS tax_id     INTEGER       REFERENCES taxes(id),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Tax on sales order lines
ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS tax_id     INTEGER       REFERENCES taxes(id),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Tax on sales invoice lines
ALTER TABLE sales_invoice_lines
  ADD COLUMN IF NOT EXISTS tax_id     INTEGER       REFERENCES taxes(id),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Tax total on header tables
ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Default sale tax on products (mirrors purchase_tax_id pattern)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_tax_id INTEGER REFERENCES taxes(id);

-- Link credit note allocations to actual sales invoices
ALTER TABLE credit_note_allocations
  ADD COLUMN IF NOT EXISTS sales_invoice_id INTEGER REFERENCES sales_invoices(id);

-- Shipped status on orders: status column already supports any varchar,
-- so no schema change needed — just add 'shipped' between confirmed and delivered.
