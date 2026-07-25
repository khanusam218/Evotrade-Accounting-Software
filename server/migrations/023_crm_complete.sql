-- Lead number (L-XXXXX)
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS number VARCHAR(50) UNIQUE;

-- CRM Tickets
CREATE TABLE IF NOT EXISTS crm_tickets (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50)  UNIQUE,
  title        VARCHAR(300) NOT NULL,
  customer_id  INTEGER      REFERENCES customers(id),
  contact_name VARCHAR(200),
  phone        VARCHAR(50),
  city         VARCHAR(100),
  tag          VARCHAR(100),
  assigned_to  VARCHAR(200),
  status       VARCHAR(50)  NOT NULL DEFAULT 'open',
  created_by   VARCHAR(200),
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- CRM Events
CREATE TABLE IF NOT EXISTS crm_events (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(50)  UNIQUE,
  subject      VARCHAR(300) NOT NULL,
  customer_id  INTEGER      REFERENCES customers(id),
  lead_id      INTEGER      REFERENCES crm_leads(id),
  contact_name VARCHAR(200),
  phone        VARCHAR(50),
  event_type   VARCHAR(100),
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  assigned_to  VARCHAR(200),
  status       VARCHAR(50)  NOT NULL DEFAULT 'planned',
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- CRM Calls
CREATE TABLE IF NOT EXISTS crm_calls (
  id                  SERIAL PRIMARY KEY,
  number              VARCHAR(50)  UNIQUE,
  date                DATE         NOT NULL,
  contact_name        VARCHAR(200),
  customer_id         INTEGER      REFERENCES customers(id),
  lead_id             INTEGER      REFERENCES crm_leads(id),
  phone               VARCHAR(50),
  call_type           VARCHAR(50)  NOT NULL DEFAULT 'outbound',
  call_purpose        VARCHAR(100),
  duration_minutes    INTEGER,
  assigned_to         VARCHAR(200),
  status              VARCHAR(50)  NOT NULL DEFAULT 'completed',
  follow_up_required  BOOLEAN      NOT NULL DEFAULT FALSE,
  follow_up_date      DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('L-',   1, 5) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('T-',   1, 5) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('EV-',  1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('CL-',  1, 5) ON CONFLICT DO NOTHING;
