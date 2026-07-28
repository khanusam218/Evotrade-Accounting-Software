-- ============================================================
-- Migration 088: POS cash movements (Cash In / Cash Out)
-- The POS Terminal's Funds Transfer modal had no backing table at
-- all, so its TRANSFER button had nothing to submit to and the
-- Daily Summary's cash_in/cash_out columns were hardcoded to 0.
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER       NOT NULL REFERENCES pos_sessions(id),
  movement_type   VARCHAR(20)   NOT NULL, -- 'cash_in' | 'cash_out'
  from_account_id INTEGER       REFERENCES chart_of_accounts(id),
  to_account_id   INTEGER       REFERENCES chart_of_accounts(id),
  amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  comments        TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_session ON pos_cash_movements(session_id);

ALTER TABLE pos_cash_movements ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id();

SELECT setup_company_rls('pos_cash_movements');
