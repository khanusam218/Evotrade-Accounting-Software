-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  address     TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Product stock levels per warehouse (upserted when stock moves)
CREATE TABLE IF NOT EXISTS product_stock (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  qty_on_hand  NUMERIC(18,4) NOT NULL DEFAULT 0,
  UNIQUE(product_id, warehouse_id)
);

-- Stock adjustments (physical count → update on-hand)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50) UNIQUE,
  date         DATE        NOT NULL,
  warehouse_id INTEGER     NOT NULL REFERENCES warehouses(id),
  reference    VARCHAR(200),
  notes        TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
  id            SERIAL PRIMARY KEY,
  adjustment_id INTEGER       NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id    INTEGER       NOT NULL REFERENCES products(id),
  current_qty   NUMERIC(18,4) NOT NULL DEFAULT 0,
  new_qty       NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost     NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes         TEXT
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('SA-', 1, 6) ON CONFLICT DO NOTHING;
