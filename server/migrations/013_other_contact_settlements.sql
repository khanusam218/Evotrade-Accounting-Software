-- ============================================================
-- Migration 013: Other Contact Settlements
-- Reconciles outstanding balances for "other" contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS other_contact_settlements (
    id               SERIAL        PRIMARY KEY,
    number           VARCHAR(20)   UNIQUE NOT NULL,
    date             DATE          NOT NULL,
    contact_name     VARCHAR(255)  NOT NULL,
    reference        VARCHAR(100),
    comments         TEXT,
    auto_settle      BOOLEAN       NOT NULL DEFAULT false,
    total_receivable DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_received   DECIMAL(15,2) NOT NULL DEFAULT 0,
    status           VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft | approved | completed | cancelled
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocs_receivable_lines (
    id            SERIAL        PRIMARY KEY,
    settlement_id INTEGER       REFERENCES other_contact_settlements(id) ON DELETE CASCADE,
    reference_no  VARCHAR(100),
    description   TEXT,
    amount        DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    settled_amount DECIMAL(15,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ocs_received_lines (
    id            SERIAL        PRIMARY KEY,
    settlement_id INTEGER       REFERENCES other_contact_settlements(id) ON DELETE CASCADE,
    reference_no  VARCHAR(100),
    description   TEXT,
    amount        DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_mode  VARCHAR(20)   DEFAULT 'cash'
);

CREATE INDEX IF NOT EXISTS idx_ocs_status ON other_contact_settlements(status);
CREATE INDEX IF NOT EXISTS idx_ocs_date   ON other_contact_settlements(date DESC);
CREATE INDEX IF NOT EXISTS idx_ocsr_sid   ON ocs_receivable_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_ocsd_sid   ON ocs_received_lines(settlement_id);

INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Other Contact Settlements', 'OCS-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Other Contact Settlements');
