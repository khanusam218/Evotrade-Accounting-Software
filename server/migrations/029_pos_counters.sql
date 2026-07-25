-- Checkout Counters (named POS registers)
CREATE TABLE IF NOT EXISTS pos_counters (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  warehouse_id    INTEGER REFERENCES warehouses(id),
  cash_account_id INTEGER REFERENCES chart_of_accounts(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link sessions to counters
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS counter_id INTEGER REFERENCES pos_counters(id);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS counter_name VARCHAR(100);
