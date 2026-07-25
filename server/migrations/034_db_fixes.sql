-- Fix number_series to be idempotent across restarts
-- 1. Remove any duplicate rows (keep highest id per prefix)
DELETE FROM number_series
WHERE id NOT IN (
  SELECT MAX(id) FROM number_series GROUP BY COALESCE(prefix, name, id::text)
);

-- 2. Ensure UNIQUE constraints exist (idempotent via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='number_series' AND constraint_name='number_series_prefix_unique'
  ) THEN
    ALTER TABLE number_series ADD CONSTRAINT number_series_prefix_unique UNIQUE (prefix);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='number_series' AND constraint_name='number_series_name_unique'
  ) THEN
    ALTER TABLE number_series ADD CONSTRAINT number_series_name_unique UNIQUE (name);
  END IF;
END$$;

-- 3. Ensure name is nullable (old migrations insert without name)
ALTER TABLE number_series ALTER COLUMN name DROP NOT NULL;
