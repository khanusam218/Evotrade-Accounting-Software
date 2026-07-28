-- import_invoice_expenses was always written/read with account_id and
-- contact_id (see importInvoices.js), but the original migration (022)
-- never created these columns, so every import invoice save failed.
ALTER TABLE import_invoice_expenses ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES chart_of_accounts(id);
ALTER TABLE import_invoice_expenses ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES vendors(id);
