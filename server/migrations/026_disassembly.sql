-- Manufacturing: Disassembly Orders
CREATE TABLE IF NOT EXISTS disassembly_orders (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50)   UNIQUE,
  date         DATE          NOT NULL,
  product_id   INTEGER       NOT NULL REFERENCES products(id),
  warehouse_id INTEGER       REFERENCES warehouses(id),
  quantity     NUMERIC(18,4) NOT NULL DEFAULT 1,
  status       VARCHAR(30)   NOT NULL DEFAULT 'draft',
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disassembly_output_lines (
  id              SERIAL PRIMARY KEY,
  disassembly_id  INTEGER       NOT NULL REFERENCES disassembly_orders(id) ON DELETE CASCADE,
  product_id      INTEGER       NOT NULL REFERENCES products(id),
  quantity        NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes           TEXT
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('DS-', 1, 6) ON CONFLICT DO NOTHING;
