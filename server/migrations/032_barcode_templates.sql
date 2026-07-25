-- Barcode / QR Code label templates
CREATE TABLE IF NOT EXISTS barcode_templates (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,
  barcode_type VARCHAR(20)  NOT NULL DEFAULT 'CODE128', -- CODE128, QR, EAN13, EAN8
  page_width   DECIMAL(8,2) NOT NULL DEFAULT 210,  -- A4 mm
  page_height  DECIMAL(8,2) NOT NULL DEFAULT 297,
  label_width  DECIMAL(8,2) NOT NULL DEFAULT 50,
  label_height DECIMAL(8,2) NOT NULL DEFAULT 25,
  cols         INTEGER NOT NULL DEFAULT 4,
  rows         INTEGER NOT NULL DEFAULT 10,
  margin_top   DECIMAL(8,2) NOT NULL DEFAULT 10,
  margin_left  DECIMAL(8,2) NOT NULL DEFAULT 10,
  gap_h        DECIMAL(8,2) NOT NULL DEFAULT 5,
  gap_v        DECIMAL(8,2) NOT NULL DEFAULT 3,
  show_name    BOOLEAN NOT NULL DEFAULT true,
  show_price   BOOLEAN NOT NULL DEFAULT true,
  show_code    BOOLEAN NOT NULL DEFAULT true,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO barcode_templates (name, barcode_type, is_default) VALUES
  ('Standard Label (CODE128)', 'CODE128', true),
  ('QR Code Label', 'QR', false)
ON CONFLICT (name) DO NOTHING;
