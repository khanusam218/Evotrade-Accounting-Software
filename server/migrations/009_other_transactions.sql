-- ============================================================
-- Migration 009: Other Collections, Other Payments, Instruments
-- payment_instruments is a shared tracking table for all
-- instruments (cheques, cash, transfers) across both modules.
-- ============================================================

-- Shared instruments tracking
CREATE TABLE IF NOT EXISTS payment_instruments (
    id              SERIAL        PRIMARY KEY,
    source_type     VARCHAR(30)   NOT NULL,  -- other_collection | other_payment
    source_id       INTEGER       NOT NULL,
    payment_mode    VARCHAR(20)   NOT NULL,  -- cash | cheque | bank_transfer
    bank_name       VARCHAR(255),
    instrument_no   VARCHAR(100),
    instrument_date DATE,
    amount          DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    status          VARCHAR(20)   DEFAULT 'pending',  -- pending | cleared | bounced | void
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pi_source ON payment_instruments(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON payment_instruments(status);

-- Other Collections (money coming in)
CREATE TABLE IF NOT EXISTS other_collections (
    id              SERIAL        PRIMARY KEY,
    number          VARCHAR(20)   UNIQUE NOT NULL,
    date            DATE          NOT NULL,
    contact_name    VARCHAR(255)  NOT NULL,
    reference       VARCHAR(100),
    bank_account_id INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    comments        TEXT,
    total_amount    DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20)   DEFAULT 'draft',  -- draft | approved | cancelled
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS other_collection_adjustments (
    id            SERIAL        PRIMARY KEY,
    collection_id INTEGER       REFERENCES other_collections(id) ON DELETE CASCADE,
    account_id    INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    description   TEXT,
    amount        DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_oca_collection ON other_collection_adjustments(collection_id);

-- Other Payments (money going out)
CREATE TABLE IF NOT EXISTS other_payments (
    id              SERIAL        PRIMARY KEY,
    number          VARCHAR(20)   UNIQUE NOT NULL,
    date            DATE          NOT NULL,
    contact_name    VARCHAR(255)  NOT NULL,
    reference       VARCHAR(100),
    bank_account_id INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    comments        TEXT,
    total_amount    DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20)   DEFAULT 'draft',  -- draft | approved | cancelled
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS other_payment_adjustments (
    id         SERIAL        PRIMARY KEY,
    payment_id INTEGER       REFERENCES other_payments(id) ON DELETE CASCADE,
    account_id INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    description TEXT,
    amount     DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_opa_payment ON other_payment_adjustments(payment_id);

-- Number series
INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Other Collections', 'OC-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Other Collections');

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Other Payments', 'OP-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Other Payments');
