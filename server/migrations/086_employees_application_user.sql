-- Employee form has an "Application User" dropdown with nothing to link to.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS application_user_id INTEGER REFERENCES users(id);
