-- Application approval workflow for creatives / brands
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Existing accounts (and admins) remain usable
UPDATE users SET approval_status = 'approved', reviewed_at = COALESCE(reviewed_at, NOW())
WHERE approval_status = 'pending';

UPDATE users SET approval_status = 'approved', reviewed_at = COALESCE(reviewed_at, NOW())
WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users (approval_status);
