-- ============================================================
-- Migration 007: Expenses
-- Creates: expenses, expense_lines
--          number_series seed for E-
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id              SERIAL        PRIMARY KEY,
    number          VARCHAR(20)   UNIQUE NOT NULL,
    date            DATE          NOT NULL,
    reference       VARCHAR(100),
    vendor_id       INTEGER       REFERENCES vendors(id),
    bank_account_id INTEGER       REFERENCES bank_accounts(id) NOT NULL,
    comments        TEXT,
    gross_amount    DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20)   DEFAULT 'draft',  -- draft, approved, cancelled
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_lines (
    id          SERIAL        PRIMARY KEY,
    expense_id  INTEGER       REFERENCES expenses(id) ON DELETE CASCADE,
    account_id  INTEGER       REFERENCES chart_of_accounts(id) NOT NULL,
    description TEXT,
    amount      DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_lines_expense ON expense_lines(expense_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status       ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date         ON expenses(date DESC);

-- Number series for Expenses
INSERT INTO number_series (name, prefix, next_number, padding)
SELECT 'Expenses', 'E-', 1, 6
WHERE NOT EXISTS (SELECT 1 FROM number_series WHERE name = 'Expenses');
