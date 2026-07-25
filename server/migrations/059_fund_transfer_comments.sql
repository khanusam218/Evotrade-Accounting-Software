-- Migration 059: Add comments column to fund_transfers
ALTER TABLE fund_transfers
  ADD COLUMN IF NOT EXISTS comments TEXT;
