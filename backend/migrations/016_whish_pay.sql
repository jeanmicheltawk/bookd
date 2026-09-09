ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS collect_url TEXT,
  ADD COLUMN IF NOT EXISTS collect_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS payer_phone VARCHAR(64);

ALTER TABLE subscription_payments
  ALTER COLUMN recipient_number DROP NOT NULL,
  ALTER COLUMN recipient_number SET DEFAULT 'whish_pay';

ALTER TABLE subscription_payments
  ALTER COLUMN method SET DEFAULT 'whish_pay';
