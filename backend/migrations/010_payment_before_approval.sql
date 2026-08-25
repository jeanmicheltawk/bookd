ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS period_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Payment confirmation must not start the trial. Trial starts when the profile is approved.
UPDATE users
SET
  membership_started_at = NULL,
  membership_trial_ends_at = NULL,
  membership_ends_at = NULL,
  membership_reminder_sent_at = NULL,
  updated_at = NOW()
WHERE role = 'member'
  AND COALESCE(approval_status, 'pending') <> 'approved'
  AND (
    membership_started_at IS NOT NULL
    OR membership_trial_ends_at IS NOT NULL
    OR membership_ends_at IS NOT NULL
  );

UPDATE subscription_payments sp
SET period_applied = FALSE
WHERE status = 'confirmed'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = sp.user_id
      AND COALESCE(u.approval_status, 'pending') <> 'approved'
  );
