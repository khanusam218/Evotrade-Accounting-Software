-- Extend barcode_templates to match Splendid Barcode/QR Code form
ALTER TABLE barcode_templates
  ADD COLUMN IF NOT EXISTS unit_of_measurement  TEXT          NOT NULL DEFAULT 'in',
  ADD COLUMN IF NOT EXISTS template_types       TEXT[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quantity             INTEGER       NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS print_on_laser       BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS barcode_width        NUMERIC(8,2)  NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS barcode_height       NUMERIC(8,2)  NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS barcode_top_spacing  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_bottom        NUMERIC(8,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS company_name_show    BOOLEAN       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS company_name_font_size NUMERIC(6,1) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS company_name_left    NUMERIC(6,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_name_font_size NUMERIC(6,1) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS product_name_left    NUMERIC(6,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode_label_font_size NUMERIC(6,1) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS barcode_label_margin NUMERIC(6,1)  NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS product_price_font_size NUMERIC(6,1) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS product_price_margin NUMERIC(6,1)  NOT NULL DEFAULT 0;
