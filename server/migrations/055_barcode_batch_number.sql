-- Batch Number Barcode section fields
ALTER TABLE barcode_templates
  ADD COLUMN IF NOT EXISTS batch_number_barcode_show BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_number_show         BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_date_show          BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_number_font_size    NUMERIC(6,1) NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS expiry_date_font_size     NUMERIC(6,1) NOT NULL DEFAULT 8;
