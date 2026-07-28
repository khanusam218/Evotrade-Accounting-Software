-- Credit Notes can link an allocation to a specific Sales Invoice
-- (sales_invoice_id), reducing its balance on approve/cancel. Debit Notes had
-- no equivalent — only a free-text invoice_ref — so there was no way to tie a
-- debit note back to the Purchase Invoice it actually adjusts.
ALTER TABLE debit_note_allocations ADD COLUMN IF NOT EXISTS purchase_invoice_id INTEGER REFERENCES purchase_invoices(id);
