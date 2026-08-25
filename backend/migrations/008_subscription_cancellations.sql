CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  professional_name VARCHAR(255),
  plan VARCHAR(32) NOT NULL,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by VARCHAR(16) NOT NULL DEFAULT 'self'
    CHECK (cancelled_by IN ('self', 'admin')),
  refund_done BOOLEAN NOT NULL DEFAULT FALSE,
  refund_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_cancelled_at
  ON subscription_cancellations (cancelled_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_refund
  ON subscription_cancellations (refund_done, cancelled_at DESC);
