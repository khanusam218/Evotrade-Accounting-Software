-- Add extended settings to pos_counters
ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS pos_invoice_series_id INTEGER REFERENCES number_series(id);
ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS sale_return_series_id INTEGER REFERENCES number_series(id);
ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS pos_search_sale_order  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS pos_search_product     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pos_counters ADD COLUMN IF NOT EXISTS primary_search         TEXT    NOT NULL DEFAULT 'product';

-- Seed POS-specific number series if not present
INSERT INTO number_series (name, prefix, next_number, padding)
VALUES ('POS Invoice', 'PI-', 1, 6) ON CONFLICT DO NOTHING;

INSERT INTO number_series (name, prefix, next_number, padding)
VALUES ('POS Sale Return', 'PSR-', 1, 6) ON CONFLICT DO NOTHING;
