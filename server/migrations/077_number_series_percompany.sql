-- ============================================================
-- Migration 077: number_series.prefix must be unique per company,
-- not system-wide — otherwise a second company can never get its
-- own "C-", "V-", "P-" etc. series (self-healing creation in
-- customers.js/vendors.js/products.js would collide globally).
-- ============================================================

ALTER TABLE number_series DROP CONSTRAINT IF EXISTS number_series_prefix_unique;
ALTER TABLE number_series DROP CONSTRAINT IF EXISTS number_series_name_unique;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'number_series_prefix_company_key') THEN
    ALTER TABLE number_series ADD CONSTRAINT number_series_prefix_company_key UNIQUE (prefix, company_id);
  END IF;
END $$;
