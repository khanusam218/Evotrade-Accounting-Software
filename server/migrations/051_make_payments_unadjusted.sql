ALTER TABLE make_payments ADD COLUMN IF NOT EXISTS unadjusted_amount NUMERIC(15,4) DEFAULT 0;
UPDATE make_payments SET unadjusted_amount = total_amount WHERE unadjusted_amount = 0 AND total_amount > 0;
