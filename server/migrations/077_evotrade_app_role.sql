-- db.js runs every query as `SET LOCAL ROLE evotrade_app` so RLS policies apply.
-- That role was previously created by hand outside of migrations, so a fresh
-- database (e.g. a new managed Postgres instance) had no such role and every
-- query failed. Bootstrap it here, idempotently, and grant it access to
-- everything in the public schema (present and future).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evotrade_app') THEN
    CREATE ROLE evotrade_app NOLOGIN;
  END IF;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT evotrade_app TO %I', session_user);
END $$;

GRANT USAGE ON SCHEMA public TO evotrade_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO evotrade_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO evotrade_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO evotrade_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO evotrade_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO evotrade_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO evotrade_app;
