ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_code_company_key'
  ) THEN
    ALTER TABLE warehouses ADD CONSTRAINT warehouses_code_company_key UNIQUE (code, company_id);
  END IF;
END $$;
