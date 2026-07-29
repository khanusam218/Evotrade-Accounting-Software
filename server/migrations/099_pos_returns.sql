-- POS Sale Return: links a return transaction back to the original sale it's
-- returning against. Reporting queries (sessions-summary) already filter on
-- status='return' etc, so returns reuse pos_transactions/status rather than
-- a separate table — this was clearly the original design intent, just never
-- wired up to an actual code path that creates one.
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS original_transaction_id INTEGER REFERENCES pos_transactions(id);
