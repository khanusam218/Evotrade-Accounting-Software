-- Same class of bug as migrations 076/077: these tables' document
-- number/code was unique system-wide instead of per-company, so a brand
-- new company's first record (always numbered/coded "...001") collides
-- with an unrelated company's existing row.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('crm_calls',        'crm_calls_number_key',        'crm_calls_number_company_key',        'number'),
    ('crm_events',       'crm_events_number_key',       'crm_events_number_company_key',       'number'),
    ('crm_leads',        'crm_leads_number_key',        'crm_leads_number_company_key',        'number'),
    ('crm_tickets',      'crm_tickets_number_key',      'crm_tickets_number_company_key',      'number'),
    ('employees',        'employees_code_key',          'employees_code_company_key',          'code'),
    ('pos_sessions',     'pos_sessions_number_key',     'pos_sessions_number_company_key',     'number'),
    ('pos_transactions', 'pos_transactions_number_key', 'pos_transactions_number_company_key', 'number')
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
