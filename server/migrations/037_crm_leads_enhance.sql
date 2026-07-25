-- Enhance crm_leads with lead_status, industry, website, date, annual_revenue, num_employees
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS lead_status   VARCHAR(100);
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS industry      VARCHAR(100);
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS website       VARCHAR(300);
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS lead_date     DATE         DEFAULT CURRENT_DATE;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS num_employees  INTEGER      DEFAULT 0;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contact_name  VARCHAR(200);
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS tag           VARCHAR(100);
