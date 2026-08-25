-- If payment is already confirmed but the profile is not approved yet,
-- drop extra open invoices so the trial still starts only on approval.
UPDATE subscription_payments sp
SET
  status = 'rejected',
  review_note = COALESCE(review_note, 'Closed: a confirmed payment already exists for this application.'),
  updated_at = NOW()
WHERE sp.status IN ('awaiting', 'pending')
  AND EXISTS (
    SELECT 1 FROM subscription_payments c
    WHERE c.user_id = sp.user_id AND c.status = 'confirmed'
  )
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = sp.user_id
      AND COALESCE(u.approval_status, 'pending') <> 'approved'
  );
