CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(32) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  method VARCHAR(32) NOT NULL DEFAULT 'whish_p2p',
  recipient_number VARCHAR(64) NOT NULL,
  sender_whish_number VARCHAR(64),
  reference VARCHAR(32) NOT NULL UNIQUE,
  note TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'awaiting'
    CHECK (status IN ('awaiting', 'pending', 'confirmed', 'rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_open
  ON subscription_payments (user_id)
  WHERE status IN ('awaiting', 'pending');

CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
  ON subscription_payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user
  ON subscription_payments (user_id, created_at DESC);
