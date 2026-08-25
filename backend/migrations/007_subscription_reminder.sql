ALTER TABLE users
  ADD COLUMN IF NOT EXISTS membership_reminder_sent_at TIMESTAMPTZ;
