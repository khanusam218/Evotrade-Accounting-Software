-- Add warehouse support to POS sessions for stock deduction
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);
