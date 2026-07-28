-- profile_image stores a base64 data URI, which exceeds VARCHAR(255)
ALTER TABLE customers ALTER COLUMN profile_image TYPE TEXT;
