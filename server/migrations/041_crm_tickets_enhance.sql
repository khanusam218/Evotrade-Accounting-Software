-- Enhance crm_tickets to match Splendid Accounts Ticket-Add form
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS ticket_date      DATE;
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS project          VARCHAR(200);
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS priority         VARCHAR(50)  DEFAULT 'Not Set';
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS actual_hours     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS description      TEXT;

-- Seed ticket_date from created_at for existing rows
UPDATE crm_tickets SET ticket_date = created_at::date WHERE ticket_date IS NULL;
