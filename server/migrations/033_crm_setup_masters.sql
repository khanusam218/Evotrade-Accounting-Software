-- CRM Setup Masters
CREATE TABLE IF NOT EXISTS ticket_tags (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS lead_sources (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS lead_statuses (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
  is_won     BOOLEAN NOT NULL DEFAULT false,
  is_lost    BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS crm_event_types (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS crm_industries (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- Seed defaults
INSERT INTO ticket_tags (name, color) VALUES
  ('Bug', '#EF4444'),
  ('Feature', '#3B82F6'),
  ('Support', '#F59E0B'),
  ('Urgent', '#DC2626')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lead_sources (name) VALUES
  ('Website'),('Referral'),('Cold Call'),('Social Media'),('Trade Show'),('Email Campaign'),('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lead_statuses (name, color, is_won, is_lost, sort_order) VALUES
  ('New',          '#6B7280', false, false, 1),
  ('Contacted',    '#3B82F6', false, false, 2),
  ('Qualified',    '#8B5CF6', false, false, 3),
  ('Proposal',     '#F59E0B', false, false, 4),
  ('Negotiation',  '#F97316', false, false, 5),
  ('Won',          '#10B981', true,  false, 6),
  ('Lost',         '#EF4444', false, true,  7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO crm_event_types (name, color) VALUES
  ('Meeting',      '#3B82F6'),
  ('Call',         '#10B981'),
  ('Demo',         '#8B5CF6'),
  ('Follow-up',    '#F59E0B'),
  ('Email',        '#6B7280')
ON CONFLICT (name) DO NOTHING;

INSERT INTO crm_industries (name) VALUES
  ('Technology'),('Finance'),('Healthcare'),('Retail'),('Manufacturing'),
  ('Education'),('Real Estate'),('Logistics'),('Food & Beverage'),('Other')
ON CONFLICT (name) DO NOTHING;
