-- Import Invoice lines had no tax_id/tax_amount at all, and the header's
-- "Tax" summary row was a hardcoded "0.00" string in the client with no
-- backing column — tax was never actually computed or persisted here,
-- unlike every other invoice type (Sales/Purchase Invoice, Quotations, etc).
ALTER TABLE import_invoice_lines ADD COLUMN IF NOT EXISTS tax_id INTEGER REFERENCES taxes(id);
ALTER TABLE import_invoice_lines ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

ALTER TABLE import_invoices ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE import_invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
