-- Product form has a "Principal" (preferred supplier) dropdown that was
-- never backed by a column, and had no options to choose from at all.
ALTER TABLE products ADD COLUMN IF NOT EXISTS principal_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL;
