ALTER TABLE sales_deliveries ADD COLUMN IF NOT EXISTS subject          TEXT;
ALTER TABLE sales_deliveries ADD COLUMN IF NOT EXISTS shipping_address TEXT;
