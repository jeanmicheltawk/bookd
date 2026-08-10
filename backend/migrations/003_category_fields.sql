-- Per-category custom fields (e.g. height/weight for models, type for photographers)
CREATE TABLE IF NOT EXISTS category_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  field_type VARCHAR(32) NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'number', 'dropdown', 'textarea')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, field_key)
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_category_fields_category ON category_fields (category_id);
