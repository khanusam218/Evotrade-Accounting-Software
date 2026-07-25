ALTER TABLE rp_instruments ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES chart_of_accounts(id);
ALTER TABLE rp_instruments ADD COLUMN IF NOT EXISTS reference TEXT;
