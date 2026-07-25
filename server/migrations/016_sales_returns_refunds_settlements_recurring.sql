-- ================================================================
-- Migration 016: Sales Returns, Refunds, Settlements, Recurring Invoices
-- ================================================================

-- ── Sales Returns (SR-XXXXXX) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_returns (
  id                SERIAL PRIMARY KEY,
  number            VARCHAR(30)    NOT NULL UNIQUE,
  date              DATE           NOT NULL DEFAULT CURRENT_DATE,
  customer_id       INTEGER        NOT NULL REFERENCES customers(id),
  invoice_id        INTEGER        REFERENCES sales_invoices(id),
  reference         VARCHAR(200),
  notes             TEXT,
  gross_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  tax_amount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  discount          DECIMAL(15,2)  NOT NULL DEFAULT 0,
  net_amount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  unadjusted_amount DECIMAL(15,2)  NOT NULL DEFAULT 0,
  status            VARCHAR(30)    NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_return_lines (
  id            SERIAL PRIMARY KEY,
  return_id     INTEGER        NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id    INTEGER        REFERENCES products(id),
  description   VARCHAR(500)   NOT NULL,
  quantity      DECIMAL(15,4)  NOT NULL DEFAULT 1,
  unit_price    DECIMAL(15,4)  NOT NULL DEFAULT 0,
  discount_pct  DECIMAL(5,2)   NOT NULL DEFAULT 0,
  amount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  tax_id        INTEGER        REFERENCES taxes(id),
  tax_amount    DECIMAL(15,2)  NOT NULL DEFAULT 0,
  disposition   VARCHAR(30)    NOT NULL DEFAULT 'restock'
);

INSERT INTO number_series (name, prefix, padding, next_number)
VALUES ('Sales Returns', 'SR-', 6, 1) ON CONFLICT (name) DO NOTHING;

-- ── Sales Refunds (CR-XXXXXX) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_refunds (
  id                SERIAL PRIMARY KEY,
  number            VARCHAR(30)    NOT NULL UNIQUE,
  date              DATE           NOT NULL DEFAULT CURRENT_DATE,
  customer_id       INTEGER        NOT NULL REFERENCES customers(id),
  return_id         INTEGER        REFERENCES sales_returns(id),
  reference         VARCHAR(200),
  notes             TEXT,
  total_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  unadjusted_amount DECIMAL(15,2)  NOT NULL DEFAULT 0,
  status            VARCHAR(30)    NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_refund_instruments (
  id          SERIAL PRIMARY KEY,
  refund_id   INTEGER        NOT NULL REFERENCES sales_refunds(id) ON DELETE CASCADE,
  mode        VARCHAR(30)    NOT NULL DEFAULT 'cash',
  bank_ref    VARCHAR(100),
  date        DATE           NOT NULL DEFAULT CURRENT_DATE,
  account_id  INTEGER        REFERENCES chart_of_accounts(id),
  amount      DECIMAL(15,2)  NOT NULL DEFAULT 0
);

INSERT INTO number_series (name, prefix, padding, next_number)
VALUES ('Sales Refunds', 'CR-', 6, 1) ON CONFLICT (name) DO NOTHING;

-- ── Sales Settlements (CS-XXXXXX) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sales_settlements (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(30)    NOT NULL UNIQUE,
  date         DATE           NOT NULL DEFAULT CURRENT_DATE,
  customer_id  INTEGER        NOT NULL REFERENCES customers(id),
  account_id   INTEGER        NOT NULL REFERENCES chart_of_accounts(id),
  reference    VARCHAR(200),
  notes        TEXT,
  total_amount DECIMAL(15,2)  NOT NULL DEFAULT 0,
  auto_settle  BOOLEAN        NOT NULL DEFAULT false,
  status       VARCHAR(30)    NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_settlement_lines (
  id            SERIAL PRIMARY KEY,
  settlement_id INTEGER        NOT NULL REFERENCES sales_settlements(id) ON DELETE CASCADE,
  invoice_id    INTEGER        NOT NULL REFERENCES sales_invoices(id),
  amount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  write_off     BOOLEAN        NOT NULL DEFAULT false
);

INSERT INTO number_series (name, prefix, padding, next_number)
VALUES ('Sales Settlements', 'CS-', 6, 1) ON CONFLICT (name) DO NOTHING;

-- ── Recurring Invoices (RI-XXXXXX) ───────────────────────────
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id              SERIAL PRIMARY KEY,
  number          VARCHAR(30)    NOT NULL UNIQUE,
  customer_id     INTEGER        NOT NULL REFERENCES customers(id),
  reference       VARCHAR(200),
  notes           TEXT,
  frequency       VARCHAR(20)    NOT NULL DEFAULT 'monthly',
  interval_num    INTEGER        NOT NULL DEFAULT 1,
  start_date      DATE           NOT NULL,
  end_date        DATE,
  next_exec_date  DATE           NOT NULL,
  last_exec_date  DATE,
  due_days        INTEGER        NOT NULL DEFAULT 30,
  gross_amount    DECIMAL(15,2)  NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  discount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  net_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  status          VARCHAR(20)    NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_invoice_lines (
  id                   SERIAL PRIMARY KEY,
  recurring_invoice_id INTEGER        NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  product_id           INTEGER        REFERENCES products(id),
  description          VARCHAR(500)   NOT NULL,
  quantity             DECIMAL(15,4)  NOT NULL DEFAULT 1,
  unit_price           DECIMAL(15,4)  NOT NULL DEFAULT 0,
  discount_pct         DECIMAL(5,2)   NOT NULL DEFAULT 0,
  amount               DECIMAL(15,2)  NOT NULL DEFAULT 0,
  tax_id               INTEGER        REFERENCES taxes(id),
  tax_amount           DECIMAL(15,2)  NOT NULL DEFAULT 0
);

INSERT INTO number_series (name, prefix, padding, next_number)
VALUES ('Recurring Invoices', 'RI-', 6, 1) ON CONFLICT (name) DO NOTHING;
