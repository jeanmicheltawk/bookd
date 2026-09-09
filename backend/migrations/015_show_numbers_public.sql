-- Phone and WhatsApp stay private on public profiles unless the creator opts in.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_numbers_public BOOLEAN NOT NULL DEFAULT FALSE;
