-- Purchase Invoice's Shipping Charges and Round Off fields display on the
-- form but the columns never existed, so nothing was ever persisted or
-- included in net_amount.
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS shipping_charges NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS round_off NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Sales Invoice's Round Off field has the same problem (shipping_charges
-- already exists and is wired up correctly on that table).
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS round_off NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Purchase Return's Round Off field is the same issue on that table too.
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS round_off NUMERIC(18,2) NOT NULL DEFAULT 0;
