-- Import Invoices (Landed Cost)
CREATE TABLE IF NOT EXISTS import_invoices (
  id                SERIAL PRIMARY KEY,
  number            VARCHAR(50)   UNIQUE,
  date              DATE          NOT NULL,
  vendor_id         INTEGER       NOT NULL REFERENCES vendors(id),
  order_id          INTEGER       REFERENCES purchase_orders(id),
  due_date          DATE,
  reference         VARCHAR(200),
  notes             TEXT,
  status            VARCHAR(30)   NOT NULL DEFAULT 'draft',
  net_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
  expense_total     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_landed_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
  balance_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_invoice_lines (
  id                SERIAL PRIMARY KEY,
  import_invoice_id INTEGER       NOT NULL REFERENCES import_invoices(id) ON DELETE CASCADE,
  product_id        INTEGER       REFERENCES products(id),
  description       TEXT          NOT NULL DEFAULT '',
  quantity          NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount            NUMERIC(18,2) NOT NULL DEFAULT 0,
  allocation_pct    NUMERIC(8,4)  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_invoice_expenses (
  id                   SERIAL PRIMARY KEY,
  import_invoice_id    INTEGER       NOT NULL REFERENCES import_invoices(id) ON DELETE CASCADE,
  expense_type         VARCHAR(100)  NOT NULL DEFAULT 'other',
  description          VARCHAR(200),
  amount               NUMERIC(18,2) NOT NULL DEFAULT 0,
  distribution_method  VARCHAR(20)   NOT NULL DEFAULT 'value'
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('II-', 1, 6) ON CONFLICT DO NOTHING;
