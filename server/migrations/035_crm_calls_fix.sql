-- Fix crm_calls: align column names with the application route
-- Rename date -> call_date and change to timestamptz to support date+time input
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_calls' AND column_name='date') THEN
    ALTER TABLE crm_calls RENAME COLUMN date TO call_date;
  END IF;
END$$;

ALTER TABLE crm_calls ALTER COLUMN call_date DROP NOT NULL;
ALTER TABLE crm_calls ALTER COLUMN call_date TYPE TIMESTAMPTZ USING call_date::TIMESTAMPTZ;

-- Add subject column if missing
ALTER TABLE crm_calls ADD COLUMN IF NOT EXISTS subject VARCHAR(300);
