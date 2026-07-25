-- Other Contacts
CREATE TABLE IF NOT EXISTS other_contacts (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50)  UNIQUE,
  print_name     VARCHAR(200) NOT NULL,
  other_name     VARCHAR(200),
  category       VARCHAR(100),
  contact_person VARCHAR(200),
  email          VARCHAR(200),
  phone_1        VARCHAR(50),
  phone_2        VARCHAR(50),
  address        TEXT,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Prospects
CREATE TABLE IF NOT EXISTS prospects (
  id                       SERIAL PRIMARY KEY,
  code                     VARCHAR(50)  UNIQUE,
  print_name               VARCHAR(200) NOT NULL,
  contact_person           VARCHAR(200),
  email                    VARCHAR(200),
  phone                    VARCHAR(50),
  address                  TEXT,
  is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
  converted_to_customer_id INTEGER      REFERENCES customers(id),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Couriers
CREATE TABLE IF NOT EXISTS couriers (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50)  UNIQUE,
  print_name     VARCHAR(200) NOT NULL,
  contact_person VARCHAR(200),
  email          VARCHAR(200),
  phone          VARCHAR(50),
  address        TEXT,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sales Persons
CREATE TABLE IF NOT EXISTS sales_persons (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  type             VARCHAR(50)  NOT NULL DEFAULT 'salesman',
  email            VARCHAR(200),
  phone            VARCHAR(50),
  can_change_price BOOLEAN      NOT NULL DEFAULT FALSE,
  can_add_discount BOOLEAN      NOT NULL DEFAULT FALSE,
  is_manager       BOOLEAN      NOT NULL DEFAULT FALSE,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('OC-',  1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('PR-',  1, 6) ON CONFLICT DO NOTHING;
INSERT INTO number_series (prefix, next_number, padding) VALUES ('COU-', 1, 6) ON CONFLICT DO NOTHING;
