-- Product form has an image uploader that was never backed by a column.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
