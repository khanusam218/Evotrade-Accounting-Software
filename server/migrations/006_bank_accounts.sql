-- ============================================================
-- Migration 006: Bank Accounts
-- Each bank account auto-creates a linked chart_of_accounts entry.
-- account_group and is_credit_card are immutable after creation.
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id             SERIAL       PRIMARY KEY,
    coa_id         INTEGER      REFERENCES chart_of_accounts(id) NOT NULL UNIQUE,
    bank_name      VARCHAR(255) NOT NULL,
    branch_name    VARCHAR(255),
    account_number VARCHAR(100),
    account_holder VARCHAR(255),
    account_group  VARCHAR(20)  NOT NULL DEFAULT 'transactional', -- transactional | control
    is_credit_card BOOLEAN      DEFAULT false,
    is_active      BOOLEAN      DEFAULT true,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_coa ON bank_accounts(coa_id);
