-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL UNIQUE,
  manager_id INTEGER,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Designations
CREATE TABLE IF NOT EXISTS designations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  department_id INTEGER      REFERENCES departments(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50)   UNIQUE,
  name           VARCHAR(200)  NOT NULL,
  department_id  INTEGER       REFERENCES departments(id),
  designation_id INTEGER       REFERENCES designations(id),
  joining_date   DATE,
  salary         NUMERIC(18,2) NOT NULL DEFAULT 0,
  ntn            VARCHAR(50),
  cnic           VARCHAR(20),
  email          VARCHAR(200),
  phone          VARCHAR(50),
  address        TEXT,
  status         VARCHAR(20)   NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)  NOT NULL,
  customer_id INTEGER       REFERENCES customers(id),
  start_date  DATE,
  end_date    DATE,
  budget      NUMERIC(18,2) NOT NULL DEFAULT 0,
  status      VARCHAR(50)   NOT NULL DEFAULT 'active',
  notes       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO number_series (prefix, next_number, padding) VALUES ('EMP-', 1, 5) ON CONFLICT DO NOTHING;
