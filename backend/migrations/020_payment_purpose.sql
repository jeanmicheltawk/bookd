ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(32) NOT NULL DEFAULT 'renewal';

UPDATE subscription_payments
SET purpose = 'renewal'
WHERE purpose IS NULL OR purpose = '';
