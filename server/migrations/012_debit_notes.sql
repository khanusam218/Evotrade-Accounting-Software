-- ============================================================
-- Migration 012: Debit Notes
-- Issued to vendors to reduce amounts owed to them.
-- Journal on approval: Debit A/P, Credit selected Account
-- ============================================================

CREATE TABLE IF NOT EXISTS debit_notes (
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

CREATE TABLE IF NOT EXISTS debit_note_allocations (
    id            SERIAL        PRIMARY KEY,
    debit_note_id INTEGER       REFERENCES debit_notes(id) ON DELETE CASCADE,
    invoice_ref   VARCHAR(100),
    description   TEXT,
    amount        DECIMAL(15,2) NOT NULL CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_dn_status ON debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_dn_date   ON debit_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_dna_dn    ON debit_note_allocations(debit_note_id);

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Debit Notes', 'DN-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Debit Notes');
