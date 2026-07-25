-- Sales Deliveries (outbound shipments)
CREATE TABLE IF NOT EXISTS sales_deliveries (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50) UNIQUE,
  date         DATE        NOT NULL,
  order_id     INTEGER     REFERENCES sales_orders(id),
  customer_id  INTEGER     NOT NULL REFERENCES customers(id),
  warehouse_id INTEGER     NOT NULL REFERENCES warehouses(id),
  status       VARCHAR(30) NOT NULL DEFAULT 'draft',
  reference    VARCHAR(200),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_delivery_lines (
  id            SERIAL PRIMARY KEY,
  delivery_id   INTEGER       NOT NULL REFERENCES sales_deliveries(id) ON DELETE CASCADE,
  product_id    INTEGER       REFERENCES products(id),
  description   TEXT          NOT NULL DEFAULT '',
  ordered_qty   NUMERIC(18,4) NOT NULL DEFAULT 0,
  delivered_qty NUMERIC(18,4) NOT NULL DEFAULT 0
);

-- Purchase Receipts / Goods Received Notes (inbound)
CREATE TABLE IF NOT EXISTS purchase_receipts (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50) UNIQUE,
  date         DATE        NOT NULL,
  order_id     INTEGER     REFERENCES purchase_orders(id),
  vendor_id    INTEGER     NOT NULL REFERENCES vendors(id),
  warehouse_id INTEGER     NOT NULL REFERENCES warehouses(id),
  status       VARCHAR(30) NOT NULL DEFAULT 'draft',
  reference    VARCHAR(200),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_receipt_lines (
  id           SERIAL PRIMARY KEY,
  receipt_id   INTEGER       NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  product_id   INTEGER       REFERENCES products(id),
  description  TEXT          NOT NULL DEFAULT '',
  ordered_qty  NUMERIC(18,4) NOT NULL DEFAULT 0,
  received_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost    NUMERIC(18,4) NOT NULL DEFAULT 0
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('SD-',  1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('GRN-', 1, 6) ON CONFLICT DO NOTHING;
