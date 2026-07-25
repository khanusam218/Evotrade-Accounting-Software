-- Purchase Quotations (RFQ)
CREATE TABLE IF NOT EXISTS purchase_quotations (
  id           SERIAL PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id    INTEGER NOT NULL REFERENCES vendors(id),
  reference    TEXT,
  notes        TEXT,
  gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_quotation_lines (
  id           SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES purchase_quotations(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_id       INTEGER REFERENCES taxes(id),
  tax_amount   NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  number        TEXT NOT NULL UNIQUE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id     INTEGER NOT NULL REFERENCES vendors(id),
  quotation_id  INTEGER REFERENCES purchase_quotations(id),
  reference     TEXT,
  notes         TEXT,
  expected_date DATE,
  gross_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','received','invoiced','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_id       INTEGER REFERENCES taxes(id),
  tax_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  received_qty NUMERIC(15,4) NOT NULL DEFAULT 0
);

-- Purchase Invoices (Bills)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id             SERIAL PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id      INTEGER NOT NULL REFERENCES vendors(id),
  order_id       INTEGER REFERENCES purchase_orders(id),
  due_date       DATE,
  reference      TEXT,
  notes          TEXT,
  gross_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','partially_paid','paid','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_id       INTEGER REFERENCES taxes(id),
  tax_amount   NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- Make Payments (pay vendors)
CREATE TABLE IF NOT EXISTS make_payments (
  id           SERIAL PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id    INTEGER NOT NULL REFERENCES vendors(id),
  reference    TEXT,
  notes        TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS make_payment_instruments (
  id         SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES make_payments(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL DEFAULT 'bank' CHECK (mode IN ('cash','bank','cheque','card','other')),
  bank_ref   TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INTEGER REFERENCES chart_of_accounts(id),
  amount     NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id                SERIAL PRIMARY KEY,
  number            TEXT NOT NULL UNIQUE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id         INTEGER NOT NULL REFERENCES vendors(id),
  invoice_id        INTEGER REFERENCES purchase_invoices(id),
  reference         TEXT,
  notes             TEXT,
  gross_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  unadjusted_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','partially_adjusted','fully_adjusted','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id           SERIAL PRIMARY KEY,
  return_id    INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_id       INTEGER REFERENCES taxes(id),
  tax_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  disposition  TEXT NOT NULL DEFAULT 'return' CHECK (disposition IN ('return','damaged','write_off'))
);

-- Purchase Refunds (vendor refunds money back to us)
CREATE TABLE IF NOT EXISTS purchase_refunds (
  id                SERIAL PRIMARY KEY,
  number            TEXT NOT NULL UNIQUE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id         INTEGER NOT NULL REFERENCES vendors(id),
  return_id         INTEGER REFERENCES purchase_returns(id),
  reference         TEXT,
  notes             TEXT,
  total_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  unadjusted_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_refund_instruments (
  id        SERIAL PRIMARY KEY,
  refund_id INTEGER NOT NULL REFERENCES purchase_refunds(id) ON DELETE CASCADE,
  mode      TEXT NOT NULL DEFAULT 'bank' CHECK (mode IN ('cash','bank','cheque','card','other')),
  bank_ref  TEXT,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INTEGER REFERENCES chart_of_accounts(id),
  amount    NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- Purchase Settlements
CREATE TABLE IF NOT EXISTS purchase_settlements (
  id           SERIAL PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id    INTEGER NOT NULL REFERENCES vendors(id),
  account_id   INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  reference    TEXT,
  notes        TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  auto_settle  BOOLEAN NOT NULL DEFAULT FALSE,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_settlement_lines (
  id            SERIAL PRIMARY KEY,
  settlement_id INTEGER NOT NULL REFERENCES purchase_settlements(id) ON DELETE CASCADE,
  invoice_id    INTEGER NOT NULL REFERENCES purchase_invoices(id),
  amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  write_off     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Number series
INSERT INTO number_series (name, prefix, padding, next_number) VALUES
  ('Purchase Quotations', 'RFQ-', 6, 1),
  ('Purchase Orders',     'PO-',  6, 1),
  ('Purchase Invoices',   'PI-',  6, 1),
  ('Make Payments',       'MP-',  6, 1),
  ('Purchase Returns',    'PR-',  6, 1),
  ('Purchase Refunds',    'VR-',  6, 1),
  ('Purchase Settlements','PS-',  6, 1)
ON CONFLICT (name) DO NOTHING;
