-- Migration 058: Extend bank_deposit_lines with received-from details
ALTER TABLE bank_deposit_lines
  ADD COLUMN IF NOT EXISTS line_date DATE,
  ADD COLUMN IF NOT EXISTS received_from VARCHAR(200),
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS instrument_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES chart_of_accounts(id) ON DELETE SET NULL;
