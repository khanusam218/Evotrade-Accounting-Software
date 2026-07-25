-- Fix schema discrepancies between migrations and routes

-- Prospects: add missing columns
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source   VARCHAR(100);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS status   VARCHAR(30) NOT NULL DEFAULT 'active';

-- Sales persons: add code and print_name columns (route uses print_name/code)
ALTER TABLE sales_persons ADD COLUMN IF NOT EXISTS code       VARCHAR(50) UNIQUE;
ALTER TABLE sales_persons ADD COLUMN IF NOT EXISTS print_name VARCHAR(200);
-- Backfill print_name from name
UPDATE sales_persons SET print_name = name WHERE print_name IS NULL;

-- Couriers: add missing columns
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(500);
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Other contacts: add notes, normalize phone columns
ALTER TABLE other_contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE other_contacts ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Employees: add missing columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS join_date    DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account VARCHAR(200);

-- Projects: add missing columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reference  VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Prospects: use PROS- prefix (PR- conflicts with purchase returns)
INSERT INTO number_series (prefix, next_number, padding) VALUES ('PROS-', 1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('SP-',   1, 6) ON CONFLICT DO NOTHING;

-- CRM leads: add number series if not exists
INSERT INTO number_series (prefix, next_number, padding) VALUES ('L-', 1, 6) ON CONFLICT DO NOTHING;
