ALTER TABLE purchase_refund_instruments ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE purchase_refund_instruments ADD COLUMN IF NOT EXISTS instrument_no TEXT;
