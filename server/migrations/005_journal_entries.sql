-- ============================================================
-- Migration 005: Journal Entries
-- Creates: journal_entries, journal_entry_lines
--          number_series seed for JE-
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
    id           SERIAL        PRIMARY KEY,
    number       VARCHAR(20)   UNIQUE NOT NULL,
    date         DATE          NOT NULL,
    memo         TEXT          NOT NULL,
    reference    VARCHAR(100),
    status       VARCHAR(20)   DEFAULT 'draft',   -- draft, posted, cancelled
    total_debit  DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id                SERIAL        PRIMARY KEY,
    journal_entry_id  INTEGER       REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id        INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    description       TEXT,
    debit             DECIMAL(15,2) DEFAULT 0 CHECK (debit  >= 0),
    credit            DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_date   ON journal_entries(date DESC);

-- Number series for Journal Entries
INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Journal Entries', 'JE-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Journal Entries');
