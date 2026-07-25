-- Enhance crm_events to match full Event-Add form
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS priority    VARCHAR(50);
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS location    TEXT;
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS source      VARCHAR(100);
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS description TEXT;
