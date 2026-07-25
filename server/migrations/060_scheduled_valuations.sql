CREATE TABLE IF NOT EXISTS scheduled_valuations (
  id         SERIAL PRIMARY KEY,
  date       DATE         NOT NULL,
  narration  TEXT,
  status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
