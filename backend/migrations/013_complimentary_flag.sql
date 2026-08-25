ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET is_complimentary = TRUE
WHERE role = 'member' AND membership = 'free' AND is_complimentary = FALSE;
