-- ============================================================
-- Migration 014: Sales — Quotations, Orders, Invoices,
--                        Receive Payments
-- ============================================================

-- ── Sales Quotations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_quotations (
    id              SERIAL        PRIMARY KEY,
    number          VARCHAR(20)   UNIQUE NOT NULL,
    date            DATE          NOT NULL,
    customer_id     INTEGER       REFERENCES customers(id) NOT NULL,
    reference       VARCHAR(100),
    expiry_date     DATE,
    notes           TEXT,
    gross_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | sent | approved | converted | cancelled
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_quotation_lines (
    id           SERIAL        PRIMARY KEY,
    quotation_id INTEGER       REFERENCES sales_quotations(id) ON DELETE CASCADE,
    product_id   INTEGER       REFERENCES products(id),
    description  TEXT          NOT NULL,
    quantity     DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price   DECIMAL(15,4) NOT NULL DEFAULT 0,
    discount_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,
    amount       DECIMAL(15,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sq_customer ON sales_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sq_status   ON sales_quotations(status);
CREATE INDEX IF NOT EXISTS idx_sq_date     ON sales_quotations(date DESC);
CREATE INDEX IF NOT EXISTS idx_sql_quot    ON sales_quotation_lines(quotation_id);

-- ── Sales Orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
    id             SERIAL        PRIMARY KEY,
    number         VARCHAR(20)   UNIQUE NOT NULL,
    date           DATE          NOT NULL,
    delivery_date  DATE          NOT NULL,
    customer_id    INTEGER       REFERENCES customers(id) NOT NULL,
    quotation_id   INTEGER       REFERENCES sales_quotations(id),
    reference      VARCHAR(100),
    notes          TEXT,
    comments       TEXT,
    gross_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount       DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
    status         VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | confirmed | delivered | invoiced | cancelled
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id            SERIAL        PRIMARY KEY,
    order_id      INTEGER       REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id    INTEGER       REFERENCES products(id),
    description   TEXT          NOT NULL,
    quantity      DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price    DECIMAL(15,4) NOT NULL DEFAULT 0,
    discount_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0,
    amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
    invoiced_qty  DECIMAL(15,4) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status   ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_date     ON sales_orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_sol_order   ON sales_order_lines(order_id);

-- ── Sales Invoices ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_invoices (
    id             SERIAL        PRIMARY KEY,
    number         VARCHAR(20)   UNIQUE NOT NULL,
    date           DATE          NOT NULL,
    due_date       DATE,
    customer_id    INTEGER       REFERENCES customers(id) NOT NULL,
    order_id       INTEGER       REFERENCES sales_orders(id),
    reference      VARCHAR(100),
    notes          TEXT,
    gross_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount       DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status         VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | approved | partially_paid | paid | cancelled
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
    id           SERIAL        PRIMARY KEY,
    invoice_id   INTEGER       REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id   INTEGER       REFERENCES products(id),
    description  TEXT          NOT NULL,
    quantity     DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price   DECIMAL(15,4) NOT NULL DEFAULT 0,
    discount_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,
    amount       DECIMAL(15,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_si_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_si_status   ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_si_date     ON sales_invoices(date DESC);
CREATE INDEX IF NOT EXISTS idx_si_due      ON sales_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_sil_inv     ON sales_invoice_lines(invoice_id);

-- ── Receive Payments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receive_payments (
    id                SERIAL        PRIMARY KEY,
    number            VARCHAR(20)   UNIQUE NOT NULL,
    date              DATE          NOT NULL,
    customer_id       INTEGER       REFERENCES customers(id) NOT NULL,
    bank_account_id   INTEGER       REFERENCES bank_accounts(id),
    reference         VARCHAR(100),
    notes             TEXT,
    total_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
    unadjusted_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    auto_settle       BOOLEAN       NOT NULL DEFAULT false,
    status            VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | approved | cancelled
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rp_instruments (
    id              SERIAL        PRIMARY KEY,
    payment_id      INTEGER       REFERENCES receive_payments(id) ON DELETE CASCADE,
    payment_mode    VARCHAR(20)   NOT NULL DEFAULT 'cash',
    bank_name       VARCHAR(255),
    instrument_no   VARCHAR(100),
    instrument_date DATE,
    amount          DECIMAL(15,2) NOT NULL CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS rp_adjustments (
    id         SERIAL        PRIMARY KEY,
    payment_id INTEGER       REFERENCES receive_payments(id) ON DELETE CASCADE,
    account_id INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    description TEXT,
    amount     DECIMAL(15,2) NOT NULL CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS rp_allocations (
    id         SERIAL        PRIMARY KEY,
    payment_id INTEGER       REFERENCES receive_payments(id) ON DELETE CASCADE,
    invoice_id INTEGER       REFERENCES sales_invoices(id) NOT NULL,
    amount     DECIMAL(15,2) NOT NULL CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_rp_customer ON receive_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_rp_status   ON receive_payments(status);
CREATE INDEX IF NOT EXISTS idx_rpi_pay     ON rp_instruments(payment_id);
CREATE INDEX IF NOT EXISTS idx_rpa_pay     ON rp_adjustments(payment_id);
CREATE INDEX IF NOT EXISTS idx_rpall_pay   ON rp_allocations(payment_id);

-- ── Number series ─────────────────────────────────────────────
INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Sales Quotations', 'SQ-', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Sales Quotations');

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Sales Orders', 'SO-', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Sales Orders');

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Sales Invoices', 'SI-', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Sales Invoices');

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Receive Payments', 'RM-', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Receive Payments');
