-- ============================================================
-- Migration 010: Bank Deposits
-- Moves cash/cheques from Undeposited Funds → Bank Account
-- Journal: Debit Bank Account, Credit Undeposited Funds
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_deposits (
    id              SERIAL        PRIMARY KEY,
    number          VARCHAR(20)   UNIQUE NOT NULL,
    date            DATE          NOT NULL,
    bank_account_id INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    deposit_no      VARCHAR(100),
    comments        TEXT,
    total_amount    DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20)   DEFAULT 'draft',  -- draft | deposited | cleared | cancelled
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_deposit_lines (
    id          SERIAL        PRIMARY KEY,
    deposit_id  INTEGER       REFERENCES bank_deposits(id) ON DELETE CASCADE,
    description TEXT,
    amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    source_type VARCHAR(30)   DEFAULT 'manual',  -- manual | instrument
    source_id   INTEGER                          -- payment_instruments.id
);

CREATE INDEX IF NOT EXISTS idx_bd_status ON bank_deposits(status);
CREATE INDEX IF NOT EXISTS idx_bd_date   ON bank_deposits(date DESC);
CREATE INDEX IF NOT EXISTS idx_bdl_dep   ON bank_deposit_lines(deposit_id);

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Bank Deposits', 'BD-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Bank Deposits');
