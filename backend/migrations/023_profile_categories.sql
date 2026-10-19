-- Many-to-many: creators can belong to multiple searchable categories.
CREATE TABLE IF NOT EXISTS profile_categories (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_categories_category_id
  ON profile_categories (category_id);

-- Backfill from the existing primary category_id.
INSERT INTO profile_categories (profile_id, category_id)
SELECT id, category_id
FROM profiles
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
