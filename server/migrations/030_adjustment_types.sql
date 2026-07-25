-- Adjustment Types master for Stock Adjustments
CREATE TABLE IF NOT EXISTS adjustment_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  account_id  INTEGER REFERENCES chart_of_accounts(id),
  direction   VARCHAR(10) NOT NULL DEFAULT 'add' CHECK (direction IN ('add', 'subtract')),
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO adjustment_types (name, direction, description) VALUES
  ('Opening Stock',  'add',      'Initial inventory entry'),
  ('Stock Found',    'add',      'Stock found during physical count'),
  ('Stock Damage',   'subtract', 'Damaged or spoiled goods'),
  ('Stock Lost',     'subtract', 'Lost or missing stock'),
  ('Internal Use',   'subtract', 'Consumed internally'),
  ('Write-off',      'subtract', 'Written off inventory')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS adjustment_type_id INTEGER REFERENCES adjustment_types(id);
