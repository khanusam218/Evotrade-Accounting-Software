ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS sale_order_series_id INTEGER REFERENCES number_series(id) ON DELETE SET NULL;
