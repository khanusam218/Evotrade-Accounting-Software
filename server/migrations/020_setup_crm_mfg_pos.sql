-- ─── SETUP ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT
);

INSERT INTO company_settings (key, value) VALUES
  ('company_name',      'My Company'),
  ('company_address',   ''),
  ('company_phone',     ''),
  ('company_email',     ''),
  ('company_website',   ''),
  ('currency_code',     'USD'),
  ('currency_symbol',   '$'),
  ('fiscal_year_start', '01-01'),
  ('date_format',       'YYYY-MM-DD'),
  ('tax_number',        '')
ON CONFLICT DO NOTHING;

-- ─── CRM ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  company     VARCHAR(200),
  email       VARCHAR(200),
  phone       VARCHAR(50),
  source      VARCHAR(100),
  stage       VARCHAR(50)  NOT NULL DEFAULT 'new',
  probability INTEGER      NOT NULL DEFAULT 0,
  expected_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  assigned_to VARCHAR(200),
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER      NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  type        VARCHAR(50)  NOT NULL DEFAULT 'note',
  date        DATE         NOT NULL,
  subject     VARCHAR(300),
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── MANUFACTURING ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER      NOT NULL REFERENCES products(id),
  name        VARCHAR(200) NOT NULL,
  output_qty  NUMERIC(18,4) NOT NULL DEFAULT 1,
  notes       TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_components (
  id                  SERIAL PRIMARY KEY,
  bom_id              INTEGER       NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  component_product_id INTEGER      NOT NULL REFERENCES products(id),
  quantity            NUMERIC(18,4) NOT NULL DEFAULT 1,
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS work_orders (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50) UNIQUE,
  date         DATE        NOT NULL,
  bom_id       INTEGER     NOT NULL REFERENCES bill_of_materials(id),
  warehouse_id INTEGER     REFERENCES warehouses(id),
  planned_qty  NUMERIC(18,4) NOT NULL DEFAULT 1,
  produced_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  status       VARCHAR(30) NOT NULL DEFAULT 'draft',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('WO-', 1, 6) ON CONFLICT DO NOTHING;

-- ─── POS ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sessions (
  id               SERIAL PRIMARY KEY,
  number           VARCHAR(50) UNIQUE,
  opening_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_date     TIMESTAMPTZ,
  opening_balance  NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_balance  NUMERIC(18,2),
  status           VARCHAR(30) NOT NULL DEFAULT 'open',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_transactions (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50) UNIQUE,
  date         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  session_id   INTEGER      NOT NULL REFERENCES pos_sessions(id),
  customer_id  INTEGER      REFERENCES customers(id),
  subtotal     NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_total    NUMERIC(18,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total        NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  change_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(50)   NOT NULL DEFAULT 'cash',
  status       VARCHAR(30)   NOT NULL DEFAULT 'completed',
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_transaction_lines (
  id             SERIAL PRIMARY KEY,
  transaction_id INTEGER       NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id     INTEGER       REFERENCES products(id),
  description    TEXT          NOT NULL DEFAULT '',
  quantity       NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_id         INTEGER       REFERENCES taxes(id),
  tax_amount     NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount         NUMERIC(18,4) NOT NULL DEFAULT 0
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('POS-', 1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('PSS-', 1, 4) ON CONFLICT DO NOTHING;
