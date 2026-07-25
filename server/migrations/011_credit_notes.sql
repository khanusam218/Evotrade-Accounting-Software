-- ============================================================
-- Migration 011: Credit Notes
-- Issued to customers to reduce amounts owed.
-- Journal on approval: Debit selected Account, Credit A/R
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_notes (
    id                SERIAL        PRIMARY KEY,
    number            VARCHAR(20)   UNIQUE NOT NULL,
    date              DATE          NOT NULL,
    contact_name      VARCHAR(255)  NOT NULL,
    reference         VARCHAR(100),
    account_id        INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    amount            DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    unadjusted_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    comments          TEXT,
    auto_settle       BOOLEAN       NOT NULL DEFAULT false,
    status            VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | approved | cancelled
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_note_allocations (
    id             SERIAL        PRIMARY KEY,
    credit_note_id INTEGER       REFERENCES credit_notes(id) ON DELETE CASCADE,
    invoice_ref    VARCHAR(100),
    description    TEXT,
    amount         DECIMAL(15,2) NOT NULL CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_cn_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_cn_date   ON credit_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_cna_cn    ON credit_note_allocations(credit_note_id);

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Credit Notes', 'CN-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Credit Notes');
