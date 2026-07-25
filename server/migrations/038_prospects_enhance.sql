-- Enhance prospects table to match full Prospect-Add form
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS display_name   VARCHAR(200);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone_2        VARCHAR(50);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone_3        VARCHAR(50);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS city           VARCHAR(100);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS state          VARCHAR(100);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zip            VARCHAR(20);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country        VARCHAR(100);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ntn            VARCHAR(50);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS cnic           VARCHAR(50);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS photo_url      TEXT;
