-- Vendor form has an Address tab and a profile-image uploader, but neither
-- was ever backed by a real column — both were silently dropped on save.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS profile_image  TEXT,
  ADD COLUMN IF NOT EXISTS address_line1  TEXT,
  ADD COLUMN IF NOT EXISTS address_line2  TEXT,
  ADD COLUMN IF NOT EXISTS city           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country        VARCHAR(100);
