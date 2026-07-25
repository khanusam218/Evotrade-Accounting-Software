CREATE TABLE IF NOT EXISTS stock_audits (
  id          SERIAL PRIMARY KEY,
  number      TEXT NOT NULL,
  warehouse_id INTEGER REFERENCES warehouses(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_audit_lines (
  id          SERIAL PRIMARY KEY,
  audit_id    INTEGER NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  description TEXT,
  warehouse_id INTEGER REFERENCES warehouses(id),
  quantity    NUMERIC(14,4) NOT NULL DEFAULT 0
);

INSERT INTO number_series (prefix, next_number, padding)
VALUES ('SAU-', 1, 6)
ON CONFLICT (prefix) DO NOTHING;
