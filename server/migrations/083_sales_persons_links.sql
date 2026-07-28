-- Sales Person form has Cash Account / Sale Order Series / Receive Payment
-- Series / Manager / Application User dropdowns, none of which were ever
-- backed by a column — all silently discarded on save.
ALTER TABLE sales_persons
  ADD COLUMN IF NOT EXISTS cash_account_id            INTEGER REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_order_series_id        INTEGER REFERENCES number_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receive_payment_series_id   INTEGER REFERENCES number_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id                  INTEGER REFERENCES sales_persons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL;
