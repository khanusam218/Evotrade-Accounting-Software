-- Same class of bug as migrations 076/077/084: these tables' document
-- number was unique system-wide instead of per-company, so a brand new
-- company's first Expense/Fund Transfer (always numbered "...-000001")
-- collides with an unrelated company's existing row, surfacing as an
-- opaque "Internal server error" on the very first save.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('expenses',        'expenses_number_key',        'expenses_number_company_key',        'number'),
    ('fund_transfers',  'fund_transfers_number_key',  'fund_transfers_number_company_key',  'number')
  ) AS t(tbl, old_con, new_con, col)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = r.tbl) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.old_con);
      EXCEPTION WHEN OTHERS THEN NULL; END;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.new_con) THEN
        BEGIN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%I, company_id)', r.tbl, r.new_con, r.col);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'UNIQUE constraint % skipped: %', r.new_con, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;
