-- ============================================================
-- Migration 080: Custom Fields
-- Generic, reusable custom fields for Customers/Vendors/Products
-- (and any future entity_type). A "definition" is created once per
-- company (e.g. "Tax Exemption No."); each record of that entity
-- type can then hold one text value per definition.
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id          SERIAL PRIMARY KEY,
  entity_type VARCHAR(50)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INTEGER     NOT NULL,
  definition_id INTEGER     NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value         TEXT,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id();
ALTER TABLE custom_field_values      ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_field_definitions_entity_name_company_key') THEN
    ALTER TABLE custom_field_definitions
      ADD CONSTRAINT custom_field_definitions_entity_name_company_key UNIQUE (entity_type, name, company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_field_values_entity_def_key') THEN
    ALTER TABLE custom_field_values
      ADD CONSTRAINT custom_field_values_entity_def_key UNIQUE (entity_type, entity_id, definition_id);
  END IF;
END $$;

SELECT setup_company_rls('custom_field_definitions');
SELECT setup_company_rls('custom_field_values');
