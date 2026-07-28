-- Every approved Sales/Purchase Invoice, Payment, Return, Refund, Settlement,
-- Credit/Debit Note, Bank Deposit, Fund Transfer, and Expense currently moves
-- Chart of Accounts balances directly instead of also posting a real Journal
-- Entry, so Trial Balance / P&L / Balance Sheet / Ledger never see them.
-- These columns let each document's approve/cancel routes post a real JE and
-- reliably find + reverse it again on cancel, without touching the
-- human-readable `reference` field.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
