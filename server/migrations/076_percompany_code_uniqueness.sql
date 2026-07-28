-- ============================================================
-- Migration 076: fix cross-tenant "code" collisions
-- Migration 064 made `code` unique per-company for customers,
-- vendors, products, and chart_of_accounts, but missed several
-- other tables whose codes are auto-generated the same way.
-- A brand-new company could get a "duplicate key" error on save
-- purely because an UNRELATED company already used that code.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('warehouses',      'warehouses_code_key',      'warehouses_code_company_key',      'code'),
    ('couriers',        'couriers_code_key',        'couriers_code_company_key',        'code'),
    ('sales_persons',   'sales_persons_code_key',   'sales_persons_code_company_key',   'code'),
    ('other_contacts',  'other_contacts_code_key',  'other_contacts_code_company_key',  'code'),
    ('prospects',       'prospects_code_key',       'prospects_code_company_key',       'code')
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
