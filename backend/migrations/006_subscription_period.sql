-- Paid plans include a 7-day free trial, so the first period is 1 month + 7 days.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS membership_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_membership_ends_at
  ON users (membership_ends_at)
  WHERE membership_ends_at IS NOT NULL;

-- Give current paid creatives a fresh period so existing profiles are not mass-expired.
UPDATE users
SET
  membership_started_at = NOW(),
  membership_trial_ends_at = NOW() + INTERVAL '7 days',
  membership_ends_at = NOW() + INTERVAL '1 month 7 days',
  updated_at = NOW()
WHERE role = 'member'
  AND membership IN ('basic', 'premium')
  AND membership_ends_at IS NULL;
