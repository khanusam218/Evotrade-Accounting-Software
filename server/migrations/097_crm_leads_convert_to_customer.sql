-- CRM Leads have no way to become a Customer once qualified. Add a link so a
-- lead can be converted (mirrors prospects.converted_to_customer_id).
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS converted_to_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
