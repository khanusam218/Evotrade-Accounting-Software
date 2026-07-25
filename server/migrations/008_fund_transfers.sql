-- ============================================================
-- Migration 008: Funds Transfers
-- Transfers between two bank accounts.
-- From/To accounts must differ.
-- Posting: Debit To account, Credit From account.
-- ============================================================

CREATE TABLE IF NOT EXISTS fund_transfers (
    id                   SERIAL        PRIMARY KEY,
    number               VARCHAR(20)   UNIQUE NOT NULL,
    date                 DATE          NOT NULL,
    reference            VARCHAR(100),
    from_bank_account_id INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    to_bank_account_id   INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    amount               DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    status               VARCHAR(20)   DEFAULT 'draft',  -- draft, posted, cancelled
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_different_accounts CHECK (from_bank_account_id <> to_bank_account_id)
);

CREATE INDEX IF NOT EXISTS idx_ft_status ON fund_transfers(status);
CREATE INDEX IF NOT EXISTS idx_ft_date   ON fund_transfers(date DESC);

-- Number series for Funds Transfer
INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Fund Transfers', 'FT-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Fund Transfers');
