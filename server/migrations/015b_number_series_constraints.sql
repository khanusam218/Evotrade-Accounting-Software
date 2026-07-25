-- Migrations 016+ insert into number_series via `ON CONFLICT (name) DO NOTHING`
-- and some insert rows without a name at all. Both require the UNIQUE(name)
-- constraint and the nullable `name` column that 034_db_fixes.sql establishes
-- -- but that file runs much later in migration order. On this repo's
-- long-lived local database these fixes were applied out of sequence by
-- hand at some point, so migrations 016-031 "worked" there without ever
-- being correct in file order. Running the migrations in order against a
-- fresh database (as any new deployment does) fails at 016. Pull the same
-- idempotent fix forward so a fresh database bootstraps correctly.
-- (034_db_fixes.sql keeps its copy of this too -- it just no-ops there now.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='number_series' AND constraint_name='number_series_name_unique'
  ) THEN
    ALTER TABLE number_series ADD CONSTRAINT number_series_name_unique UNIQUE (name);
  END IF;
END$$;

ALTER TABLE number_series ALTER COLUMN name DROP NOT NULL;
