-- Add phone_2 and city to crm_events to match Event list columns
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS phone_2 VARCHAR(50);
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS city    VARCHAR(100);
