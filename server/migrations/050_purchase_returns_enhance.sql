ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS shipping_charges NUMERIC(15,4) DEFAULT 0;
