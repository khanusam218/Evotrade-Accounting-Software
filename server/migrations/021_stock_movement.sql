-- Warehouse-to-warehouse stock transfers
CREATE TABLE IF NOT EXISTS stock_movements (
  id                SERIAL PRIMARY KEY,
  number            VARCHAR(50)   UNIQUE,
  date              DATE          NOT NULL,
  from_warehouse_id INTEGER       NOT NULL REFERENCES warehouses(id),
  to_warehouse_id   INTEGER       NOT NULL REFERENCES warehouses(id),
  reference         VARCHAR(200),
  notes             TEXT,
  status            VARCHAR(30)   NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movement_lines (
  id          SERIAL PRIMARY KEY,
  movement_id INTEGER       NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  product_id  INTEGER       NOT NULL REFERENCES products(id),
  quantity    NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes       TEXT
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('SM-', 1, 6) ON CONFLICT DO NOTHING;
